import websocket from 'websocket'
import {BaseClient} from './baseClient.js'

let latency;


/**
 * A client that connects to a websocket.
 */
export class WebsocketClient extends BaseClient {
	constructor(loadTest) {
		super(loadTest);
		this.latency = loadTest.latency
		this.connection = null;
		this.lastCall = null;
		this.client = null;
		this.init();
	}

	/**
	 * Start the websocket client.
	 */
	start() {
		this.client = new websocket.client();
		this.client.on('connectFailed', () => {});
		this.client.on('connect', connection => this.connect(connection));
		this.client.connect(this.options.url, []);
	}

	/**
	 * Stop the websocket client.
	 */
	stop() {
		if (this.connection) {
			this.connection.close();
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
		const id = this.latency.begin();
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
					console.error('Invalid message type ' + message.type);
					return;
				}
				let json;
				try {
					json = JSON.parse(message.utf8Data);
				}
				catch(e) {
					console.error('Invalid JSON: ' + message.utf8Data);
					return;
				}

				// eat the client_connected message we get at the beginning
				if ((json && json[0] && json[0][0] == 'client_connected')) {
					ended = false;
					return;
				}

				if (this.lastCall) {
					const newCall = new Date().getTime();
					latency.add(newCall - this.lastCall);
					this.lastCall = null;
				}

				requestFinished(null, json);
			});

			let message={some:"message"};

			if (this.generateMessage) {
				message = this.generateMessage(id);
			}
			if (typeof this.options.requestGenerator == 'function') {
				// create a 'fake' object which can function like the http client
				const req = () => {
					return {
						write: message => {
							this.connection.sendUTF(message);
						}
					};
				};
				this.options.requestGenerator(this.options, this.params, req, requestFinished);
			} else {
				this.connection.sendUTF(JSON.stringify(message));
			}
		}
	}
}

