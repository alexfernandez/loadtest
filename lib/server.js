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
var log = new Log('info');
var port = 80;


/**
 * Listen to an incoming request.
 */
function listen(request, response)
{
	var id = latency.start();
	log.debug('Headers: %s', util.inspect(request.headers));
	response.end('OK');
	latency.end(id);
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
	console.log('Usage: %s %s [port]');
	console.log('  starts a test server on the given port, default 80.');
}

/**
 * Process command line arguments.
 */
function processArgs(args)
{
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

