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
var microtime = require('microtime');
var prototypes = require('./prototypes.js');

// globals
var log = new Log('info');
var concurrency = 10;
var requestsPerSecond = 20;
var secondsMeasured = 5;
var server = 'localhost:80';


/**
 * Latency measurements, global variable.
 */
var latency = new function()
{
	// self-reference
	var self = this;

	// attributes
	var requests = {};
	var measurements = [];
	var index = 0;
	var max = concurrency * requestsPerSecond * secondsMeasured;
	var total = 0;

	/**
	 * Initialize.
	 */
	self.init = function()
	{
		max = concurrency * requestsPerSecond * secondsMeasured;
	}

	/**
	 * Start the request with the given id.
	 */
	self.start = function(requestId)
	{
		requests[requestId] = microtime.now();
	}

	/**
	 * Compute elapsed time and add the measurement.
	 */
	self.end = function(requestId)
	{
		if (!(requestId in requests))
		{
			log.error('Message id ' + requestId + ' not found');
			return;
		}
		add(microtime.now() - requests[requestId]);
		delete requests[requestId];
	}

	/**
	 * Add a new measurement, possibly removing an old one.
	 */
	function add(value)
	{
		log.debug('New value: %s', value);
		measurements.push(value);
		total += value;
		if (measurements.length > max)
		{
			var removed = measurements.shift();
			total -= removed;
		}
		index++;
		log.debug('Index: %s, max %s', index, max);
		if (index > max)
		{
			var mean = total / measurements.length;
			log.info('Mean latency: %s ms', Math.round(mean / 10) / 100);
			index = 0;
		}
	}
}

/**
 * A client for an HTTP connection.
 */
function HttpClient(url)
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
		setInterval(get, Math.round(1000 / requestsPerSecond));
	}

	function get()
	{
		var id = Math.floor(Math.random() * 0x100000000).toString(16);
		latency.start(id);
		var options = urlLib.parse(url);
		options.agent = false;
		var get = http.get(url, getConnect(id));
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
function WebsocketClient(url)
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
			log.info('Starting game for ' + self.playerId);
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
 * Display online help.
 */
function help()
{
	console.log('Usage: %s %s [concurrency] [reqs/s] [seconds measured] URL');
	console.log('  where URL can be a regular HTTP or websocket URL.');
	console.log('  If you want to add an index to the URL, place a $index in it.');
}

/**
 * Process command line arguments.
 */
function processArgs(args)
{
	if (args.length == 0)
	{
		return help();
	}
	if (parseInt(args[0]))
	{
		concurrency = parseInt(args[0]);
		args.splice(0, 1);
		if (parseInt(args[0]))
		{
			requestsPerSecond = parseInt(args[0]);
			args.splice(0, 1);
			if (parseInt(args[0]))
			{
				secondsMeasured = parseInt(args[0]);
				args.splice(0, 1);
			}
		}
	}
	latency.init();
	if (args.length != 1)
	{
		return help();
	}
	var url = args[0];
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
function startClients(url, constructor)
{
	for (var index = 0; index < concurrency; index++)
	{
		var url = url.replaceAll('$index', index);
		var client = constructor(url);
		// start each client 100 ms after the last
		setTimeout(client.start, (index * 100) % 1000);
	}
}

// init
processArgs(process.argv.slice(2));

