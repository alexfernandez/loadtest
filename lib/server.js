'use strict';

/**
 * Test server to load test.
 * (C) 2013 Alex Fernández.
 */


// requires
var http = require('http');
var util = require('util');
var Log = require('log');
var latency = require('./latency.js');
var prototypes = require('./prototypes.js');

// globals
var log = new Log('debug');
var port = 80;
var headersDebuggedTime = Date.now();

// constants
var DEBUG_HEADERS_INTERVAL_SECONDS = 1;


/**
 * Listen to an incoming request.
 */
function listen(request, response)
{
	var id = latency.start();
	var now = Date.now();
	if (now - headersDebuggedTime > DEBUG_HEADERS_INTERVAL_SECONDS * 1000)
	{
		log.debug('Headers: %s', util.inspect(request.headers));
		headersDebuggedTime = now;
	}
	response.end('OK');
	latency.end(id);
}

/**
 * Display online help.
 */
function help()
{
	console.log('Usage: %s %s [port]');
	console.log('  starts a test server on the given port, default 80.');
}

/**
 * Process command line arguments.
 */
function processArgs(args)
{
	latency.init(5);
	while (args.length > 0)
	{
		var arg = args[0];
		if (parseInt(arg))
		{
			port = parseInt(arg);
		}
		else
		{
			help();
			return;
		}
		args.splice(0, 1);
	}
	var server = http.createServer(listen);
	server.on('error', function(error)
	{
		if (error.code == 'EADDRINUSE')
		{
			log.error('Port %s in use, please free it and retry again', port);
		}
		else
		{
			log.error('Could not start server on port %s: %s', port, error);
		}
		return;
	});
	server.listen(port, function()
	{
		log.info('Listening on port %s', port);
	});
}

// init
processArgs(process.argv.slice(2));

