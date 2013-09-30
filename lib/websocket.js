'use strict';

/**
 * Load test a websocket.
 * (C) 2013 Alex Fernández.
 */


// requires
require('prototypes');
var WebSocketClient = require('websocket').client;
var testing = require('testing');
var Log = require('log');

// globals
var log = new Log('info');
var latency;


/**
 * A client that connects to a websocket.
 */
exports.WebsocketClient = function(url, requestsPerSecond)
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
	};

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
					log.error('Invalid message type ' + message.type);
					return;
				}
				if (lastCall)
				{
					var newCall = new Date().getTime();
					latency.add(newCall - lastCall);
					log.deubg('latency: ' + (newCall - lastCall));
					lastCall = null;
				}
				var json;
				try
				{
					json = JSON.parse(message.utf8Data);
				}
				catch(e)
				{
					log.error('Invalid JSON: ' + message.utf8Data);
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
			log.error('Wrong message ' + JSON.stringify(message));
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
};

/**
 * Run tests, currently nothing.
 */
exports.test = function(callback)
{
	testing.success(callback);
};

// start load test if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

