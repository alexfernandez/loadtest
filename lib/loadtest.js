import * as http from 'http'
import * as https from 'https'
import * as httpClient from './httpClient.js'
import * as netClient from './netClient.js'
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
 *	 - url: URL to access (mandatory).
 *	 - concurrency: how many concurrent clients to use.
 *	 - maxRequests: how many requests to send
 *	 - maxSeconds: how long to run the tests.
 *	 - cookies: a string or an array of strings, each with name:value.
 *	 - headers: a map with headers: {key1: value1, key2: value2}.
 *	 - method: the method to use: POST, PUT. Default: GET, what else.
 *	 - data: the contents to send along a POST or PUT request.
 *	 - contentType: the MIME type to use for the body, default text/plain.
 *	 - requestsPerSecond: how many requests per second to send.
 *	 - agentKeepAlive: if true, then use connection keep-alive.
 *	 - indexParam: string to replace with a unique index.
 *	 - insecure: allow https using self-signed certs.
 *	 - secureProtocol: TLS/SSL secure protocol method to use.
 *	 - proxy: use a proxy for requests e.g. http://localhost:8080.
 *	 - quiet: do not log any messages.
 *	 - debug: show debug messages (deprecated).
 *	 - requestGenerator: use a custom function to generate requests.
 *	 - statusCallback: function called after every request.
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
	return await runLoadTest(processed)
}

function runLoadTest(options) {
	return new Promise((resolve, reject) => {
		const operation = new LoadTest(options, (error, result) => {
			if (error) {
				return reject(error)
			}
			return resolve(result)
		});
		operation.start();
	})
}

/**
 * Used to keep track of individual load test runs.
 */
let operationInstanceIndex = 0;

/**
 * A load test operation.
 */
class LoadTest {
	constructor(options, callback) {
		this.options = options;
		this.finalCallback = callback;
		this.running = true;
		this.latency = null;
		this.clients = [];
		this.requests = 0;
		this.completedRequests = 0;
		this.showTimer = null;
		this.stopTimeout = null;
		this.instanceIndex = operationInstanceIndex++;
		this.requestIndex = 0
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
	 * Call after each request has finished.
	 */
	finishRequest(error, result, next) {
		this.completedRequests += 1;
		if (this.options.maxRequests) {
			if (this.completedRequests == this.options.maxRequests) {
				this.stop();
			}
		}
		if (this.running && !this.options.requestsPerSecond) {
			next();
		}
		if (this.options.statusCallback) {
			result.requestIndex = this.requestIndex++
			result.instanceIndex = this.instanceIndex
			this.options.statusCallback(error, result);
		}
	}

	/**
	 * Start a number of measuring clients.
	 */
	startClients() {
		for (let index = 0; index < this.options.concurrency; index++) {
			const createClient = this.getClientCreator()
			const client = createClient(this, this.options);
			this.clients.push(client)
			if (!this.options.requestsPerSecond) {
				client.start();
			} else {
				// start each client at a random moment in one second
				const offset = Math.floor(Math.random() * 1000);
				setTimeout(() => client.start(), offset);
			}
		}
	}

	getClientCreator() {
		// TODO: || this.options.url.startsWith('wss:'))
		if (this.options.url.startsWith('ws:')) {
			return websocket.create;
		}
		if (this.options.net) {
			return netClient.create
		}
		return httpClient.create;
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
		for (const client of this.clients) {
			client.stop();
		}
		if (this.finalCallback) {
			const result = this.latency.getResult();
			result.instanceIndex = this.instanceIndex;
			this.finalCallback(null, result);
		} else {
			this.latency.show();
		}
	}
}

