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
var requests = 0;

// constants
var DEFAULT_OPTIONS = {
	noAgent: true,
	concurrency: 1,
	requestsPerSecond: 1,
};


/**
 * A client for an HTTP connection.
 * Params is an object which must contain:
 *	- url: destination URL.
 *	- requestsPerSecond: how many requests to create from this client.
 * Params may have:
 *	- method: HTTP method (default GET).
 *	- payload: contents of request (default empty).
 *	- maxRequests: stop sending requests after this global limit is reached.
 *	- requestsPerSecond: limit requests per second to send.
 *	- maxSeconds: stop receiving requests after this number of seconds.
 *	- noAgent: if true, do not use connection keep-alive (default false).
 */
function HttpClient(params)
{
	// self-reference
	var self = this;

	// attributes
	var connection;
	var lastCall;
	var timer;

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
		timer = new timing.HighResolutionTimer(interval, self.makeRequest);
	}

	/**
	 * Stop the HTTP client.
	 */
	self.stop = function()
	{
		timer.stop();
	}

	/**
	 * Make a single request to the server.
	 */
	self.makeRequest = function(callback)
	{
		requests += 1;
		if (requests > params.maxRequests)
		{
			if (callback)
			{
				callback(null);
			}
			return timer.stop();
		}
		var id = latency.start(id);
		var options = urlLib.parse(params.url);
		if (params.noAgent)
		{
			options.agent = false;
		}
		if (params.method)
		{
			options.method = params.method;
		}
		var message;
		if (params.payload)
		{
			var message;
			if (typeof params.payload == 'string')
			{
				message = params.payload;
			}
			else if (typeof params.payload == 'object')
			{
				message = JSON.stringify(params.payload);
			}
			else
			{
				log.error('Unrecognized payload: %s', typeof params.payload);
			}
			options.headers = {
				'Content-Length': message.length,
			};
		}
		var request = http.request(options, getConnect(id, function(error, result)
		{
			if (error)
			{
				log.error('Connection %s failed: %s', id, error);
			}
			else
			{
				log.debug('Connection %s ended', id);
			}
			latency.end(id);
			if (callback)
			{
				callback(error, result);
			}
		}));
		if (message)
		{
			request.write(message);
		}
		request.on('error', function(error)
		{
			log.error('Error: %s', error.message);
		});
		request.end();
	}

	/**
	 * Get a function to connect the player.
	 */
	function getConnect(id, callback)
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
				callback('Connection ' + id + ' failed: ' + error);
				
			});
			connection.on('end', function(result)
			{
				if (connection.statusCode >= 300)
				{
					return callback('Status code ' + connection.statusCode);
				}
				callback(null, false);
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
 *	- maxRequests: how many requests to send
 *	- maxSeconds: how long to run the tests.
 *	- noAgent: if true, then do not use connection keep-alive.
 * An optional callback will be called if/when the test finishes.
 */
exports.loadTest = function(options, callback)
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
	if (callback)
	{
		options.callback = callback;
	}
	latency = new timing.Latency(options);
	startClients(options, constructor);
}

/**
 * Start a number of measuring clients.
 */
function startClients(options, constructor)
{
	var clients = {};
	var url = options.url;
	for (var index = 0; index < options.concurrency; index++)
	{
		if (options.indexParam)
		{
			options.url = url.replaceAll(indexParam, index);
		}
		clients[index] = constructor(options);
		// start each client 100 ms after the last
		setTimeout(clients[index].start, (index * 100) % 1000);
	}
	if (options.maxSeconds)
	{
		setTimeout(getClientStopper(clients), options.maxSeconds * 1000);
	}
}

/**
 * Get a function that stops all clients.
 */
var getClientStopper = function(clients)
{
	return function()
	{
		for (var index in clients)
		{
			clients[index].stop();
		}
	};
}

/**
 * Display online help.
 */
function help()
{
	console.log('Usage: loadtest [options] URL');
	console.log('  where URL can be a regular HTTP or websocket URL.');
	console.log('Options are:');
	console.log('    -n requests     Number of requests to perform');
	console.log('    -c concurrency  Number of multiple requests to make');
	console.log('    -t timelimit    Seconds to max. wait for responses');
	console.log('    --rps           Requests per second for each client');
	console.log('    --noagent       Do not use http agent (default)');
	console.log('    --agent         Use http agent (Connection: keep-alive)');
	console.log('    --index param   Replace the value of param with an index in the URL');
}

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
	if (!args[0].startsWith('-'))
	{
		return false;
	}
	// consume the argument
	var argument = args.shift();
	switch(argument)
	{
		case '-n':
			options.maxRequests = args.shift();
			return true;
		case '-c':
			options.concurrency = args.shift();
			return true;
		case '-t':
			options.maxSeconds = args.shift();
			return true;
		case '--rps':
			options.requestsPerSecond = args.shift();
			return true;
		case '--noagent':
			return true;
		case '--agent':
			options.noAgent = false;
			return true;
	}
	console.error('Unknown option %s', argument);
	return false;
}

/**
 * Process command line arguments and run
 */
exports.run = function(args)
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
	exports.run(process.argv.slice(2));
}

