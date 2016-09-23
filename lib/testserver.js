'use strict';

/**
 * Test server to load test.
 * (C) 2013 Alex Fernández.
 */


// requires
require('prototypes');
var testing = require('testing');
var http = require('http');
var WebSocketServer = require('websocket').server;
var util = require('util');
var net = require('net');
var Log = require('log');
var timing = require('./timing.js');

// globals
var log = new Log('debug');

// constants
var PORT = 7357;
var LOG_HEADERS_INTERVAL_SECONDS = 1;


/**
 * A test server, with the given options (see below on startServer()).
 */
function TestServer(options)
{
	// self-reference
	var self = this;

	// attributes
	var port = options.port || PORT;
	var server, wsServer;
	var latency = new timing.Latency({});
	var debuggedTime = Date.now();

	// init
	if (options.quiet)
	{
		log.level = 'notice';
	}
	
	/**
	 * Start the server.
	 * An optional callback will be called after the server has started.
	 */
	self.start = function(callback)
	{
		if (options.socket)
		{
			// just for internal debugging
			server = net.createServer(socketListen);
		}
		else
		{
			server = http.createServer(listen);

			wsServer = new WebSocketServer({
			httpServer: server,
			autoAcceptConnections: false // OK only because this is for testing only
			});
		}
		server.on('error', function(error)
		{
			if (error.code == 'EADDRINUSE')
			{
				return createError('Port ' + port + ' in use, please free it and retry again', callback);
			}
			return createError('Could not start server on port ' + port + ': ' + error, callback);
		});
		server.listen(port, function()
		{
			log.info('Listening on port %s', port);
			if (callback)
			{
				callback();
			}
		});
		wsServer.on('request', function(request)
		{
			// explicity omitting origin check here.
			var connection = request.accept(null, request.origin);
			log.debug(' Connection accepted.');
			connection.on('message', function(message)
			{
				if (message.type === 'utf8')
				{
					log.debug('Received Message: ' + message.utf8Data);
					connection.sendUTF(message.utf8Data);
				}
				else if (message.type === 'binary')
				{
					log.debug('Received Binary Message of ' + message.binaryData.length + ' bytes');
					connection.sendBytes(message.binaryData);
				}
			});
			connection.on('close', function()
			{
				log.info('Peer %s disconnected', connection.remoteAddress);
			});
		});
		return server;
	};

	/**
	 * Log an error, or send to the callback if present.
	 */
	function createError(message, callback)
	{
		if (!callback)
		{
			return log.error(message);
		}
		callback(message);
	}

	/**
	 * Listen to an incoming request.
	 */
	function listen(request, response)
	{
		var id = latency.start();
		request.body = '';
		request.on('data', function(data)
		{
			request.body += data.toString();
		});
		request.on('end', function()
		{
			var now = Date.now();
			if (now - debuggedTime > LOG_HEADERS_INTERVAL_SECONDS * 1000)
			{
				debug(request);
				debuggedTime = now;
			}
			if (!options.delay)
			{
				return end(response, id);
			}
			setTimeout(function()
			{
				end(response, id);
			}, options.delay);
		});
	}

	/**
	 * Listen on a socket.
	 */
	function socketListen(socket)
	{
		socket.on('error', function(error)
		{
			log.error('socket error: %s', error);
			socket.end();
		});
		socket.on('data', readData);
	}

	/**
	 * Read some data off the socket.
	 */
	function readData(data)
	{
		log.info('data: %s', data);
	}

	/**
	 * Debug headers and other interesting information: POST body.
	 */
	function debug(request)
	{
		log.info('Headers for %s to %s: %s', request.method, request.url, util.inspect(request.headers));
		if (request.body)
		{
			log.info('Body: %s', request.body);
		}
	}

	/**
	 * End the response now.
	 */
	function end(response, id)
	{
		if (shouldError())
		{
			var code = options.error || 500;
			response.writeHead(code);
			response.end('ERROR');
		}
		else
		{
			response.end('OK');
		}
		latency.end(id);
	}

	function shouldError()
	{
		if (!options.percent)
		{
			if (options.error)
			{
				return true;
			}
			return false;
		}
		var percent = parseInt(options.percent, 10);
		if (!percent)
		{
			log.error('Invalid error percent %s', options.percent);
			return false;
		}
		return (Math.random() < percent / 100);
	}
}

/**
 * Start a test server. Options can contain:
 *	- port: the port to use, default 7357.
 *	- delay: wait the given milliseconds before answering.
 *	- quiet: do not log any messages.
 *	- percent: give an error (default 500) on some % of requests.
 *	- error: set an HTTP error code, default is 500.
 * An optional callback is called after the server has started.
 * In this case the quiet option is enabled.
 */
exports.startServer = function(options, callback)
{
	if (callback)
	{
		options.quiet = true;
	}
	var server = new TestServer(options);
	return server.start(callback);
};

function testStartServer(callback)
{
	var options = {
		port: 10530,
	};
	var server = exports.startServer(options, function(error)
	{
		testing.check(error, 'Could not start server', callback);
		server.close(function(error)
		{
			testing.check(error, 'Could not stop server', callback);
			testing.success(callback);
		});
	});
}

/**
 * Run the tests.
 */
exports.test = function(callback)
{
	testing.run([testStartServer], 5000, callback);
};

// start server if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

