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
var BaseClient = require('./base-client.js').BaseClient;

// globals
var log = new Log('debug');
var latency;


/**
 * A client that connects to a websocket.
 */
module.exports.WebsocketClient = function(operation, params)
{
	BaseClient.call(this, operation, params);

	// self-reference
	var self = this;

	// attributes
	var connection;
	var lastCall;

	self.client = null;

	this.init();

	/**
	 * Start the websocket client.
	 */
	self.start = function()
	{
		self.client = new WebSocketClient();
		self.client.on('connectFailed', function(error) {
			log.debug('WebSocket client connection error ' + error);
		});
		self.client.on('connect', connect);
		self.client.connect(params.url, []);
		log.debug('WebSocket client connected to ' + params.url);
	};


	self.startRequests = function()
	{
		return self.makeRequest();
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
	 * Make a single request to the server.
	 */
	self.makeRequest = function()
	{
		var id = operation.latency.start(id);
		var requestFinished = self.getRequestFinisher(id);

		if (connection.connected)
		{
			var transaction_ended = false;


			// NOTE: there are no per-request callbacks (and no notion of request/response)
			// in the websockets package.  So we can't support requestsPerSecond; everythinng must
			// be synchronous per connection.

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

				if (message.type != 'utf8')
				{
					log.error('Invalid message type ' + message.type);
					return;
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

				log.debug("Received response %j", json);

				// eat the client_connected message we get at the beginning
				if ((json && json[0] && json[0][0] == 'client_connected')) {
					transaction_ended = false;
					return;
				}

				if (lastCall)
				{
					var newCall = new Date().getTime();
					latency.add(newCall - lastCall);
					log.debug('latency: ' + (newCall - lastCall));
					lastCall = null;
				}

				requestFinished(null, json);
			});

			var request, message;

			if (self.generateMessage)
			{
				message = self.generateMessage(id);
				if(typeof message === 'object')
				{
					message = JSON.stringify(message);
				}
			}

			if (typeof params.requestGenerator == 'function')
			{
				// create a 'fake' object which can function like the http client
				var req = function(options, callback) {
					return {
						write: function(message) {
							connection.sendUTF(message)
						} 
					}
				}
				params.requestGenerator(self.params, self.options, req, requestFinished);
			}
			else
			{
				connection.sendUTF(JSON.stringify(message));
			}
		}
	}
};


module.exports.WebsocketClient.prototype = Object.create(BaseClient.prototype);
module.exports.WebsocketClient.prototype.constructor = module.exports.WebsocketClient;

module.exports.WebsocketClient.prototype.init = function()
{
    Object.getPrototypeOf(this.constructor.prototype).init.call(this);
};

/**
 * Run tests, currently nothing.
 */
module.exports.test = function(callback)
{
	testing.success(callback);
};

// start load test if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

