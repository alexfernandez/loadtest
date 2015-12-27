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
var log = new Log('debug');
var latency;


/**
 * A client that connects to a websocket.
 */
exports.WebsocketClient = function(operation, params)
{
	// self-reference
	var self = this;

	// attributes
	var connection;
	var lastCall;

	self.client = null;


	function init()
	{
		options = urlLib.parse(params.url);

		if (params.cert && params.key)
		{
			options.cert = params.cert;
			options.key = params.key;
		}

		if (params.body)
		{
			if (typeof params.body == 'string')
			{
				log.debug('Received string body');
				generateMessage = identity(params.body);
			}
			else if (typeof params.body == 'object')
			{
				log.debug('Received JSON body');
				generateMessage = identity(params.body);
			}
			else if (typeof params.body == 'function')
			{
				log.debug('Received function body');
				generateMessage = params.body;
			}
			else
			{
				log.error('Unrecognized body: %s', typeof params.body);
			}
			options.headers['Content-Type'] = params.contentType || 'text/plain';
		}

		if (params.secureProtocol) {
			options.secureProtocol = params.secureProtocol;
		}

		log.debug('Options: %j', options);
	}

	/**
	 * Start the websocket client.
	 */
	self.start = function()
	{
		self.client = new WebSocketClient();
		self.client.on('connectFailed', function(error) {
//				error('Connect Error: ' + error);
			console.log("hello");
			log.debug('ERROR! ' + error);
		});
		self.client.on('connect', connect);
		console.log("URL " + params.url)
		log.debug('WebSocket client connected to ' + params.url);
		self.client.connect(params.url, []);
		log.debug('WebSocket client connected to ' + params.url);
	};


	self.startRequests = function()
	{
		if (!params.requestsPerSecond)
		{
			return self.makeRequest();
		}
		var interval = 1000 / params.requestsPerSecond;
		requestTimer = new timing.HighResolutionTimer(interval, self.makeRequest);
	}

	/**
	 * Stop the websocket client.
	 */
	self.stop = function()
	{
		if (connection)
		{
			connection.close();
			log.debug('WebSocket client disconnected from ' + params.url);
		}
	};

	/**
	 * Connect the player.
	 */
	function connect(localConnection)
	{
		connection = localConnection;

		self.startRequests();
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
		log.debug('Received message');
		log.debug(message);
		if (message.type == 'start')
		{
			log.debug('Starting game for ' + self.playerId);
			setInterval(requestUpdate, Math.round(1000 / requestsPerSecond));
			return;
		}
	}

	/**
	 * Make a single request to the server.
	 */
	self.makeRequest = function()
	{
		var id = operation.latency.start(id);
		var requestFinished = getRequestFinisher(id);

		if (connection.connected)
		{
			var transaction_ended = false;
			connection.on('error', function(error) {
				if (transaction_ended) return;
				transaction_ended = true;
				requestFinished('Connection error: ' + error);
			});
			connection.on('close', function() {
				if (transaction_ended) return;
				transaction_ended = true;
				requestFinished('Connection closed ');
			});
			connection.on('message', function(message) {
				if (transaction_ended) return;
				transaction_ended = true;
					log.debug('message received + ' + message)
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

					requestFinished(null, json);
			});

			var update = {
				requestId: Math.floor(Math.random() * 0x100000000).toString(16),
				type: 'ping',
			};
			connection.sendUTF(JSON.stringify(update));
		}
	}


	/**
	 * Get a function that finishes one request and goes for the next.
	 */
	function getRequestFinisher(id)
	{
		return function(error, result)
		{
			var errorCode = null;
			if (error)
			{
				log.debug('Connection %s failed: %s', id, error);
				if (result)
				{
					errorCode = result;
				}
				else
				{
					errorCode = '-1';
				}
			}
			else
			{
				log.debug('Connection %s ended', id);
			}
			operation.latency.end(id, errorCode);
			var callback;
			if (!params.requestsPerSecond)
			{
				callback = self.makeRequest;
			}
			operation.callback(error, result, callback);
		};
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

