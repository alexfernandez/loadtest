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
	var headersDebuggedTime = Date.now();

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
		var now = Date.now();
		if (now - headersDebuggedTime > LOG_HEADERS_INTERVAL_SECONDS * 1000)
		{
			log.info('Headers: %s', util.inspect(request.headers));
			headersDebuggedTime = now;
		}
		if (!options.delay)
		{
			return end(response, id);
		}
		setTimeout(function()
		{
			end(response, id);
		}, options.delay);
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
}

/**
 * Display online help.
 */
function help()
{
	console.log('Usage: testserver [options] [port]');
	console.log('  starts a test server on the given port, default 80.');
    console.log('Options are:');
	console.log('    --delay           Delay the response for the given milliseconds');
}

/**
 * Process command line arguments.
 */
exports.run = function(args)
{
	var options = {};
	while (args.length > 0 && args[0].startsWith('--'))
	{
		var arg = args.shift();
		if (arg == '--delay')
		{
			options.delay = parseInt(args.shift());
		}
		else
		{
			return help();
		}
	}
	if (args.length > 1)
	{
		return help();
	}
	if (args.length == 1)
	{
		var arg = args[0];
		if (parseInt(arg))
		{
			options.port = parseInt(arg);
		}
		else
		{
			return help();
		}
	}
	exports.startServer(options);
}

// start server if invoked directly
if (__filename == process.argv[1])
{
	exports.run(process.argv.slice(2));
}

