import * as http from 'http'
import * as https from 'https'
import * as httpClient from './httpClient.js'
import * as websocket from './websocket.js'
import {Latency} from './latency.js'
import {HighResolutionTimer} from './hrtimer.js'
import {processOptions} from './options.js'

const SHOW_INTERVAL_MS = 5000;

http.globalAgent.maxSockets = 1000;
https.globalAgent.maxSockets = 1000;


/**
 * Run a load test.
 * Parameters:
 * - `options`: an object which may have:
 *	 - url [string]: URL to access (mandatory).
 *	 - concurrency [number]: how many concurrent clients to use.
 *	 - maxRequests [number]: how many requests to send
 *	 - maxSeconds [number]: how long to run the tests.
 *	 - cookies [array]: a string or an array of strings, each with name:value.
 *	 - headers [map]: a map with headers: {key1: value1, key2: value2}.
 *	 - method [string]: the method to use: POST, PUT. Default: GET, what else.
 *	 - body [string]: the contents to send along a POST or PUT request.
 *	 - contentType [string]: the MIME type to use for the body, default text/plain.
 *	 - requestsPerSecond [number]: how many requests per second to send.
 *	 - agentKeepAlive: if true, then use connection keep-alive.
 *	 - indexParam [string]: string to replace with a unique index.
 *	 - insecure: allow https using self-signed certs.
 *	 - secureProtocol [string]: TLS/SSL secure protocol method to use.
 *	 - proxy [string]: use a proxy for requests e.g. http://localhost:8080.
 *	 - quiet: do not log any messages.
 *	 - debug: show debug messages (deprecated).
 *	 - requestGenerator [function]: use a custom function to generate requests.
 * - `callback`: optional `function(result, error)` called if/when the test finishes;
 * if not present a promise is returned.
 */
export function loadTest(options, callback) {
	if (!callback) {
		return loadTestAsync(options)
	}
	loadTestAsync(options).then(result => callback(null, result)).catch(error => callback(error))
}

async function loadTestAsync(options) {
	const processed = await processOptions(options)
	return await runOperation(processed)
}

function runOperation(options) {
	return new Promise((resolve, reject) => {
		const operation = new Operation(options, (error, result) => {
			if (error) {
				return reject(error)
			}
			return resolve(result)
		});
		operation.start();
	})
}

/**
 * Used to keep track of individual load test Operation runs.
 */
let operationInstanceIndex = 0;

/**
 * A load test operation.
 */
class Operation {
	constructor(options, callback) {
		this.options = options;
		this.finalCallback = callback;
		this.running = true;
		this.latency = null;
		this.clients = {};
		this.requests = 0;
		this.completedRequests = 0;
		this.showTimer = null;
		this.stopTimeout = null;
		this.instanceIndex = operationInstanceIndex++;
	}

	/**
	 * Start the operation.
	 */
	start() {
		this.latency = new Latency(this.options);
		this.startClients();
		if (this.options.maxSeconds) {
			this.stopTimeout = setTimeout(() => this.stop(), this.options.maxSeconds * 1000).unref();
		}
		this.showTimer = new HighResolutionTimer(SHOW_INTERVAL_MS, () => this.latency.showPartial());
		this.showTimer.unref();
	}

	/**
	 * Call after each operation has finished.
	 */
	callback(error, result, next) {
		this.completedRequests += 1;
		if (this.options.maxRequests) {
			if (this.completedRequests == this.options.maxRequests) {
				this.stop();
			}
		}
		if (this.running && next) {
			next();
		}
		if (this.options.statusCallback) {
			this.options.statusCallback(error, result, this.latency.getResult());
		}
	}

	/**
	 * Start a number of measuring clients.
	 */
	startClients() {
		const url = this.options.url;
		const strBody = JSON.stringify(this.options.body);
		for (let index = 0; index < this.options.concurrency; index++) {
			if (this.options.indexParam) {
				let oldToken = new RegExp(this.options.indexParam, 'g');
				if(this.options.indexParamCallback instanceof Function) {
					let customIndex = this.options.indexParamCallback();
					this.options.url = url.replace(oldToken, customIndex);
					if(this.options.body) {
						let body = strBody.replace(oldToken, customIndex);
						this.options.body = JSON.parse(body);
					}
				}
				else {
					this.options.url = url.replace(oldToken, index);
					if(this.options.body) {
						let body = strBody.replace(oldToken, index);
						this.options.body = JSON.parse(body);
					}
				}
			}
			let constructor = httpClient.create;
			// TODO: || this.options.url.startsWith('wss:'))
			if (this.options.url.startsWith('ws:')) {
				constructor = websocket.create;
			}
			const client = constructor(this, this.options);
			this.clients[index] = client;
			if (!this.options.requestsPerSecond) {
				client.start();
			} else {
				// start each client at a random moment in one second
				const offset = Math.floor(Math.random() * 1000);
				setTimeout(() => client.start(), offset);
			}
		}
	}

	/**
	 * Stop clients.
	 */
	stop() {
		this.running = false;
		this.latency.finish()
		if (this.showTimer) {
			this.showTimer.stop();
		}
		if (this.stopTimeout) {
			clearTimeout(this.stopTimeout);
		}
		Object.keys(this.clients).forEach(index => {
			this.clients[index].stop();
		});
		if (this.finalCallback) {
			const result = this.latency.getResult();
			result.instanceIndex = this.instanceIndex;
			this.finalCallback(null, result);
		} else {
			this.latency.show();
		}
	}
}

