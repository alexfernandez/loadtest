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
var globalConcurrency = 100;
var globalRequestsPerSecond = 1;
var agent = true;


/**
 * A client for an HTTP connection.
 */
function HttpClient(url, requestsPerSecond)
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
		var interval = Math.round(1000 / requestsPerSecond);
		new timing.HighResolutionTimer(interval, makeRequest);
	}

	/**
	 * Make a single request to the server.
	 */
	function makeRequest()
	{
		var id = timing.latency.start(id);
		var options = urlLib.parse(url);
		if (!agent)
		{
			options.agent = false;
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
			log.debug('HTTP client connected to %s with id %s', url, id);
			connection.setEncoding('utf8');
			connection.on('data', function(chunk)
			{
				log.debug('Body: %s', chunk);
			});
			connection.on('error', function(error)
			{
				log.error('Connection %s failed: %s', id, error);
				timing.latency.end(id);
				
			});
			connection.on('end', function(result)
			{
				log.debug('Connection %s ended', id);
				timing.latency.end(id);
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
		log.info('WebSocket client connected to ' + url);
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
				log.info('Connection closed');
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
					timing.latency.add(newCall - lastCall);
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
			log.info('Starting game for ' + self.playerId);
			setInterval(requestUpdate, Math.round(1000 / requestsPerSecond));
			return;
		}
		if (message.requestId)
		{
			timing.latency.end(message.requestId);
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
			timing.latency.start(update.requestId);
		}
	}
}

/**
 * Run a load test.
 */
exports.loadTest(url, concurrency, requestsPerSecond)
{
	var constructor;
	if (url.startsWith('ws://'))
	{
		constructor = function(url)
		{
			return new WebsocketClient(url);
		};
	}
	else if (url.startsWith('http'))
	{
		constructor = function(url)
		{
			return new HttpClient(url);
		};
	}
	else
	{
		return help();
	}
	startClients(url, constructor);
}

/**
 * Start a number of measuring clients.
 */
function startClients(url, concurrency, requestsPerSecond, constructor)
{
	for (var index = 0; index < concurrency; index++)
	{
		url = url.replaceAll('$index', index);
		var client = constructor(url, requestsPerSecond);
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
 * Parse one argument. Returns true if there are more.
 */
function parseArgument(args)
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
			globalConcurrency = parseInt(argument);
		}
		else if (numbersParsed == 1)
		{
			globalRequestsPerSecond = parseInt(argument);
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
		console.error('Unknown argument %s', argument);
		return false;
	}
   	if (argument == '--noagent')
	{
		agent = false;
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
	while (parseArgument(args))
	{
	}
	if (args.length != 1)
	{
		return help();
	}
	var url = args[0];
	loadTest(url, globalConcurrency, globalRequestsPerSecond);
}

// start load test if invoked directly
if (__filename == process.argv[1])
{
	processArgs(process.argv.slice(2));
}

