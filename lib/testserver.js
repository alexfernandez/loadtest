'use strict';

/**
 * Test server to load test.
 * (C) 2013 Alex Fernández.
 */


// requires
var http = require('http');
var util = require('util');
var Log = require('log');
var timing = require('./timing.js');
var prototypes = require('./prototypes.js');

// globals
var log = new Log('info');

// constants
var PORT = 80;
var LOG_HEADERS_INTERVAL_SECONDS = 1;


/**
 * A test server, with the given options (port and delay).
 */
function TestServer(options)
{
	// self-reference
	var self = this;

	// attributes
	var port = options.port || PORT;
	var server;
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
		server = http.createServer(listen);
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
		return server
	}

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
	 * Debug headers and other interesting information: POST body.
	 */
	function debug(request)
	{
		log.info('Headers for %s: %s', request.method, util.inspect(request.headers));
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
		response.end('OK');
		latency.end(id);
	}
}

/**
 * Start a test server. Options can contain:
 *	- port: the port to use, default 80.
 *	- delay: wait the given milliseconds before answering.
 *	- quiet: do not log any messages.
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

// start server if invoked directly
if (__filename == process.argv[1])
{
	exports.run(process.argv.slice(2));
}

