'use strict';

/**
 * Load Test a URL, website or websocket.
 * (C) 2013 Alex Fernández.
 */


// requires
const Log = require('log');
const http = require('http');
const https = require('https');
const testing = require('testing');
const httpClient = require('./httpClient.js');
const websocket = require('./websocket.js');
const {Latency} = require('./latency.js');
const {HighResolutionTimer} = require('./hrtimer.js');

// globals
const log = new Log('info');

// constants
const SHOW_INTERVAL_MS = 5000;

// init
http.globalAgent.maxSockets = 1000;
https.globalAgent.maxSockets = 1000;


/**
 * Run a load test.
 * Options is an object which may have:
 *	- url: mandatory URL to access.
 *	- concurrency: how many concurrent clients to use.
 *	- maxRequests: how many requests to send
 *	- maxSeconds: how long to run the tests.
 *	- cookies: a string or an array of strings, each with name:value.
 *	- headers: a map with headers: {key1: value1, key2: value2}.
 *	- method: the method to use: POST, PUT. Default: GET, what else.
 *	- body: the contents to send along a POST or PUT request.
 *	- contentType: the MIME type to use for the body, default text/plain.
 *	- requestsPerSecond: how many requests per second to send.
 *	- agentKeepAlive: if true, then use connection keep-alive.
 *	- debug: show debug messages.
 *	- quiet: do not log any messages.
 *	- indexParam: string to replace with a unique index.
 *	- insecure: allow https using self-signed certs.
 * An optional callback will be called if/when the test finishes.
 */
exports.loadTest = function(options, callback) {
	if (!options.url) {
		log.error('Missing URL in options');
		return;
	}
	options.concurrency = options.concurrency || 1;
	if (options.requestsPerSecond) {
		options.requestsPerSecond = options.requestsPerSecond / options.concurrency;
	}
	if (options.debug) {
		log.level = Log.DEBUG;
	}
	if (!options.url.startsWith('http://') && !options.url.startsWith('https://') && !options.url.startsWith('ws://')) {
		log.error('Invalid URL %s, must be http://, https:// or ws://', options.url);
		return;
	}
	if (callback && !('quiet' in options)) {
		options.quiet = true;
	}

	if (options.url.startsWith('ws:')) {
		if (options.requestsPerSecond) {
			log.error('"requestsPerSecond" not supported for WebSockets');
		}
	}

	const operation = new Operation(options, callback);
	operation.start();
	return operation;
};

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
			if (this.requests > this.options.maxRequests) {
				log.debug('Should have no more running clients');
			}
		}
		if (this.running && next) {
			next();
		}
		if (this.options.statusCallback) {
			this.options.statusCallback(error, result, this.latency.getResults());
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
		if (this.showTimer) {
			this.showTimer.stop();
		}
		if (this.stopTimeout) {
			clearTimeout(this.stopTimeout);
		}
		this.running = false;
		this.latency.running = false;

		Object.keys(this.clients).forEach(index => {
			this.clients[index].stop();
		});
		if (this.finalCallback) {
			const result = this.latency.getResults();
			result.instanceIndex = this.instanceIndex;
			this.finalCallback(null, result);
		} else {
			this.latency.show();
		}
	}
}

/**
 * A load test with max seconds.
 */
function testMaxSeconds(callback) {
	const options = {
		url: 'http://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
	};
	exports.loadTest(options, callback);
}


/**
 * A load test with max seconds.
 */
function testWSEcho(callback) {
	const options = {
		url: 'ws://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
	};
	exports.loadTest(options, callback);
}

function testIndexParam(callback) {
	const options = {
		url: 'http://localhost:7357/replace',
		concurrency:1,
		quiet: true,
		maxSeconds: 0.1,
		indexParam: "replace"
	};
	exports.loadTest(options, callback);
}

function testIndexParamWithBody(callback) {
	const options = {
		url: 'http://localhost:7357/replace',
		concurrency:1,
		quiet: true,
		maxSeconds: 0.1,
		indexParam: "replace",
		body: '{"id": "replace"}'
	};
	exports.loadTest(options, callback);
}

function testIndexParamWithCallback(callback) {
	const options = {
		url: 'http://localhost:7357/replace',
		concurrency:1,
		quiet: true,
		maxSeconds: 0.1,
		indexParam: "replace",
		indexParamCallback: function() {
			//https://gist.github.com/6174/6062387
			return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
		}
	};
	exports.loadTest(options, callback);
}

function testIndexParamWithCallbackAndBody(callback) {
	const options = {
		url: 'http://localhost:7357/replace',
		concurrency:1,
		quiet: true,
		maxSeconds: 0.1,
		body: '{"id": "replace"}',
		indexParam: "replace",
		indexParamCallback: function() {
			//https://gist.github.com/6174/6062387
			return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
		}
	};
	exports.loadTest(options, callback);
}


/**
 * Run all tests.
 */
exports.test = function(callback) {
	testing.run([testMaxSeconds, testWSEcho, testIndexParam, testIndexParamWithBody, testIndexParamWithCallback, testIndexParamWithCallbackAndBody], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1]) {
	exports.test(testing.show);
}

