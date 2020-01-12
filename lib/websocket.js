'use strict';

/**
 * Load test a websocket.
 * (C) 2013 Alex Fernández.
 */


// requires
const WebSocketClient = require('websocket').client;
const testing = require('testing');
const Log = require('log');
const BaseClient = require('./baseClient.js').BaseClient;

// globals
const log = new Log('info');
let latency;


/**
 * Create a client for a websocket.
 */
exports.create = function(operation, params) {
	return new WebsocketClient(operation, params);
};

/**
 * A client that connects to a websocket.
 */
class WebsocketClient extends BaseClient {
	constructor(operation, params) {
		super(operation, params);
		this.connection = null;
		this.lastCall = null;
		this.client = null;
		this.init();
	}

	/**
	 * Start the websocket client.
	 */
	start() {
		this.client = new WebSocketClient();
		this.client.on('connectFailed', error => {
			log.debug('WebSocket client connection error ' + error);
		});
		this.client.on('connect', connection => this.connect(connection));
		this.client.connect(this.params.url, []);
		log.debug('WebSocket client connected to ' + this.params.url);
	}

	/**
	 * Stop the websocket client.
	 */
	stop() {
		if (this.connection) {
			this.connection.close();
			log.debug('WebSocket client disconnected from ' + this.params.url);
		}
	}

	/**
	 * Connect the player.
	 */
	connect(localConnection) {
		this.connection = localConnection;

		this.makeRequest();
	}

	/**
	 * Make a single request to the server.
	 */
	makeRequest() {
		const id = this.operation.latency.start();
		const requestFinished = this.getRequestFinisher(id);

		if (this.connection.connected) {
			let ended = false;


			// NOTE: there are no per-request callbacks (and no notion of request/response)
			// in the websockets package.  So we can't support requestsPerSecond; everything must
			// be synchronous per connection.

			this.connection.on('error', error => {
				if (ended) return;
				ended = true;
				requestFinished('Connection error: ' + error);
			});

			this.connection.on('close', () => {
				if (ended) return;
				ended = true;
				requestFinished('Connection closed ');
			});

			this.connection.on('message', message => {
				if (ended) return;
				ended = true;

				if (message.type != 'utf8') {
					log.error('Invalid message type ' + message.type);
					return;
				}
				let json;
				try {
					json = JSON.parse(message.utf8Data);
				}
				catch(e) {
					log.error('Invalid JSON: ' + message.utf8Data);
					return;
				}

				log.debug("Received response %j", json);

				// eat the client_connected message we get at the beginning
				if ((json && json[0] && json[0][0] == 'client_connected')) {
					ended = false;
					return;
				}

				if (this.lastCall) {
					const newCall = new Date().getTime();
					latency.add(newCall - this.lastCall);
					log.debug('latency: ' + (newCall - this.lastCall));
					this.lastCall = null;
				}

				requestFinished(null, json);
			});

			let message;

			if (this.generateMessage) {
				message = this.generateMessage(id);
			}
			if (typeof this.params.requestGenerator == 'function') {
				// create a 'fake' object which can function like the http client
				const req = () => {
					return {
						write: message => {
							this.connection.sendUTF(message);
						}
					};
				};
				this.params.requestGenerator(this.params, this.options, req, requestFinished);
			} else {
				this.connection.sendUTF(JSON.stringify(message));
			}
		}
	}
}


function testWebsocketClient(callback) {
	const options = {
		url: 'ws://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
	};
	exports.create({}, options);
	testing.success(callback);
}

/**
 * Run tests, currently nothing.
 */
exports.test = function(callback) {
	testing.run([
		testWebsocketClient,
	], callback);
};

// start tests if invoked directly
if (__filename == process.argv[1]) {
	exports.test(testing.show);
}

