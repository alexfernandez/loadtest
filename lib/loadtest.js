'use strict';

/**
 * Load Test a URL, website or websocket.
 * (C) 2013 Alex Fernández.
 */


// requires
var WebSocketClient = require('websocket').client;
var urlLib = require('url');
var http = require('http');
var Log = require('log');
var prototypes = require('./prototypes.js');
var timing = require('./timing.js');

// globals
var log = new Log('info');
var latency;

// constants
var DEFAULT_OPTIONS = {
	concurrency: 100,
	requestsPerSecond: 1,
};


/**
 * A client for an HTTP connection.
 * Params is an object which may have:
 *	- requestsPerSecond: how many requests to create from this client.
 *	- noAgent: if true, do not use connection keep-alive.
 */
function HttpClient(params)
{
	// self-reference
	var self = this;

	// attributes
	var connection;
	var lastCall;

	/**
	 * Start the HTTP client.
	 */
	self.start = function()
	{
		if (!params.requestsPerSecond)
		{
			log.error('No requests per second selected');
			return;
		}
		var interval = Math.round(1000 / params.requestsPerSecond);
		new timing.HighResolutionTimer(interval, makeRequest);
	}

	/**
	 * Make a single request to the server.
	 */
	function makeRequest()
	{
		var id = latency.start(id);
		var options = urlLib.parse(params.url);
		if (params.noAgent)
		{
			options.noAgent = false;
		}
		var get = http.get(options, getConnect(id));
		get.on('error', function(error)
		{
			log.error('Error: %s', error.message);
		});
	}

	/**
	 * Get a function to connect the player.
	 */
	function getConnect(id)
	{
		return function(connection)
		{
			log.debug('HTTP client connected to %s with id %s', params.url, id);
			connection.setEncoding('utf8');
			connection.on('data', function(chunk)
			{
				log.debug('Body: %s', chunk);
			});
			connection.on('error', function(error)
			{
				log.error('Connection %s failed: %s', id, error);
				latency.end(id);
				
			});
			connection.on('end', function(result)
			{
				log.debug('Connection %s ended', id);
				latency.end(id);
			});
		};
	}
}

/**
 * A client that connects to a websocket.
 */
function WebsocketClient(url, requestsPerSecond)
{
	// self-reference
	var self = this;

	// attributes
	var connection;
	var lastCall;

	/**
	 * Start the websocket client.
	 */
	self.start = function()
	{
		var client = new WebSocketClient();
		client.on('connectFailed', function(error) {
				error('Connect Error: ' + error.toString());
		});
		client.on('connect', connect);
		client.connect(url, []);
		log.debug('WebSocket client connected to ' + url);
	}

	/**
	 * Connect the player.
	 */
	function connect(localConnection)
	{
		connection = localConnection;
		connection.on('error', function(error) {
				error("Connection error: " + error.toString());
		});
		connection.on('close', function() {
				log.debug('Connection closed');
		});
		connection.on('message', function(message) {
				if (message.type != 'utf8')
				{
					error('Invalid message type ' + message.type);
					return;
				}
				if (lastCall)
				{
					var newCall = new Date().getTime();
					latency.add(newCall - lastCall);
					entry += ', latency: ' + (newCall - lastCall);
					lastCall = null;
				}
				var json;
				try
				{
					json = JSON.parse(message.utf8Data);
				}
				catch(e)
				{
					error('Invalid JSON: ' + message.utf8Data);
					return;
				}
				receive(json);
		});

	}

	/**
	 * Receive a message from the server.
	 */
	function receive(message)
	{
		if (!message || !message.type)
		{
			error('Wrong message ' + JSON.stringify(message));
			return;
		}
		if (message.type == 'start')
		{
			log.debug('Starting game for ' + self.playerId);
			setInterval(requestUpdate, Math.round(1000 / requestsPerSecond));
			return;
		}
		if (message.requestId)
		{
			latency.end(message.requestId);
		}
	}

	/**
	 * Request an update from the server.
	 */
	function requestUpdate()
	{
		if (connection.connected)
		{
			var update = {
				requestId: Math.floor(Math.random() * 0x100000000).toString(16),
				type: 'ping',
			};
			connection.sendUTF(JSON.stringify(update));
			latency.start(update.requestId);
		}
	}
}

/**
 * Run a load test.
 * Options is an object which may have:
 *	- url: mandatory URL to access.
 *	- concurrency: how many concurrent clients to use.
 *	- requestsPerSecond: how many requests per second per client.
 *	- noAction: if true, then do not use connection keep-alive.
 */
exports.loadTest = function(options)
{
	var constructor;
	if (!options.url)
	{
		log.error('Missing URL in options');
		return;
	}
	if (options.url.startsWith('ws://'))
	{
		constructor = function(params)
		{
			return new WebsocketClient(params.url, params.requestsPerSecond);
		};
	}
	else if (options.url.startsWith('http'))
	{
		constructor = function(params)
		{
			return new HttpClient(params);
		};
	}
	else
	{
		return help();
	}
	latency = new timing.Latency(options);
	startClients(options, constructor);
}

/**
 * Start a number of measuring clients.
 */
function startClients(options, constructor)
{
	for (var index = 0; index < options.concurrency; index++)
	{
		options.url = options.url.replaceAll('$index', index);
		var client = constructor(options);
		// start each client 100 ms after the last
		setTimeout(client.start, (index * 100) % 1000);
	}
}

/**
 * Display online help.
 */
function help()
{
	console.log('Usage: %s %s [options] [concurrency] [req/s] URL');
	console.log('  where URL can be a regular HTTP or websocket URL.');
	console.log('  If you want to add an index to the URL, place a $index in it.');
	console.log('  Options:');
	console.log('    --noagent: send Connection: close');
	console.log('    --agent: send Connection: keep-alive (default)');
}

var numbersParsed = 0;

/**
 * Parse one argument and change options accordingly.
 * Returns true if there may be more arguments to parse.
 */
function parseArgument(args, options)
{
	if (args.length <= 1)
	{
		return false;
	}
	var argument = args[0];
	if (parseInt(argument))
	{
		if (numbersParsed == 0)
		{
			options.concurrency = parseInt(argument);
		}
		else if (numbersParsed == 1)
		{
			options.requestsPerSecond = parseInt(argument);
		}
		else
		{
			log.error('Too many numeric arguments');
			return false;
		}
		args.splice(0, 1);
		numbersParsed += 1;
		return true;
	}
	if (!argument.startsWith('--'))
	{
		return false;
	}
   	if (argument == '--noagent')
	{
		options.noAgent = true;
		args.splice(0, 1);
		return true;
	}
	if (argument == '--agent')
	{
		args.splice(0, 1);
		return true;
	}
	console.error('Unknown option %s', argument);
	return false;
}

/**
 * Process command line arguments.
 */
function processArgs(args)
{
	var options = DEFAULT_OPTIONS;
	while (parseArgument(args, options))
	{
	}
	if (args.length != 1)
	{
		if (args.length == 0)
		{
			console.error('Missing URL');
		}
		else
		{
			console.error('Unknown arguments %s', JSON.stringify(args));
		}
		return help();
	}
	options.url = args[0];
	exports.loadTest(options);
}

// start load test if invoked directly
if (__filename == process.argv[1])
{
	processArgs(process.argv.slice(2));
}

