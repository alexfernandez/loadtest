'use strict';

/**
 * Load Test a URL, website or websocket.
 * (C) 2013 Alex Fernández.
 */


// requires
const testing = require('testing');
const urlLib = require('url');
const http = require('http');
const https = require('https');
const qs = require('querystring');
const websocket = require('websocket');
const Log = require('log');
const timing = require('./timing.js');
const headers = require('./headers.js');

// globals
const log = new Log('info');


/**
 * Create a new HTTP client.
 * Seem parameters below.
 */
exports.create = function(operation, params) {
	return new HttpClient(operation, params);
};

/**
 * A client for an HTTP connection.
 * Operation is an object which has these attributes:
 *	- latency: a variable to measure latency.
 *	- running: if the operation is running or not.
 * Params is an object with the same options as exports.loadTest.
 */
class HttpClient {
	constructor(operation, params) {
		this.operation = operation
		this.params = params
		this.init();
	}

	/**
	 * Init options and message to send.
	 */
	init() {
		this.options = urlLib.parse(this.params.url);
		this.options.headers = {};
		if (this.params.headers) {
			this.options.headers = this.params.headers;
		}
		if (this.params.cert && this.params.key) {
			this.options.cert = this.params.cert;
			this.options.key = this.params.key;
		}
		this.options.agent = false;
		if (this.params.agentKeepAlive) {
			const KeepAlive = (this.options.protocol == 'https:') ? require('agentkeepalive').HttpsAgent : require('agentkeepalive');
			let maxSockets = 10;
			if (this.params.requestsPerSecond) {
				maxSockets += Math.floor(this.params.requestsPerSecond);
			}
			this.options.agent = new KeepAlive({
				maxSockets: maxSockets,
				maxKeepAliveRequests: 0, // max requests per keepalive socket, default is 0, no limit
				maxKeepAliveTime: 30000  // keepalive for 30 seconds
			});
		}
		if (this.params.method) {
			this.options.method = this.params.method;
		}
		if (this.params.body) {
			if (typeof this.params.body == 'string') {
				log.debug('Received string body');
				this.generateMessage = () => this.params.body;
			} else if (typeof this.params.body == 'object') {
				log.debug('Received JSON body');
				if (this.params.contentType === 'application/x-www-form-urlencoded') {
					this.params.body = qs.stringify(this.params.body);
				}
				this.generateMessage = () => this.params.body;
			} else if (typeof this.params.body == 'function') {
				log.debug('Received function body');
				this.generateMessage = this.params.body;
			} else {
				log.error('Unrecognized body: %s', typeof this.params.body);
			}
			this.options.headers['Content-Type'] = this.params.contentType || 'text/plain';
		}
		if (this.params.cookies) {
			if (Array.isArray(this.params.cookies)) {
				this.options.headers.Cookie =  this.params.cookies.join('; ');
			} else if (typeof this.params.cookies == 'string') {
				this.options.headers.Cookie = this.params.cookies;
			} else {
				console.error('Invalid cookies %j, please use an array or a string', this.params.cookies);
			}
		}
		headers.addUserAgent(this.options.headers);
		if (this.params.secureProtocol) {
			this.options.secureProtocol = this.params.secureProtocol;
		}
		log.debug('Options: %j', this.options);
	}

	/**
	 * Start the HTTP client.
	 */
	start() {
		if (!this.params.requestsPerSecond) {
			return this.makeRequest();
		}
		const interval = 1000 / this.params.requestsPerSecond;
		this.requestTimer = new timing.HighResolutionTimer(interval, () => this.makeRequest());
	}

	/**
	 * Stop the HTTP client.
	 */
	stop() {
		if (this.requestTimer) {
			this.requestTimer.stop();
		}
	}

	/**
	 * Make a single request to the server.
	 */
	makeRequest() {
		if (!this.operation.running) {
			return;
		}
		if (this.operation.options.maxRequests && this.operation.requests >= this.operation.options.maxRequests) return
		this.operation.requests += 1;

		const id = this.operation.latency.start();
		const requestFinished = this.getRequestFinisher(id);
		let lib = http;
		if (this.options.protocol == 'https:') {
			lib = https;
		}
		if (this.options.protocol == 'ws:') {
			lib = websocket;
		}
		const HttpsProxyAgent = require('https-proxy-agent');

		// adding proxy configuration 
		if (this.params.proxy) {
			const proxy = this.params.proxy;
			//console.log('using proxy server %j', proxy);
			const agent = new HttpsProxyAgent(proxy);
			this.options.agent = agent;
		}
		
		
		// Disable certificate checking
		if (this.params.insecure === true) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		}
		let request, message;
		if (this.generateMessage) {
			message = this.generateMessage(id);
			if (typeof message === 'object') {
				message = JSON.stringify(message);
			}
			this.options.headers['Content-Length'] = Buffer.byteLength(message);
		} else {
			delete this.options.headers['Content-Length'];
		}
		if (typeof this.params.requestGenerator == 'function') {
			request = this.params.requestGenerator(this.params, this.options, lib.request, this.getConnect(id, requestFinished));
		} else {
			request = lib.request(this.options, this.getConnect(id, requestFinished));
		}
		if (this.params.hasOwnProperty('timeout')) {
			const timeout = parseInt(this.params.timeout);
			if (!timeout) {
				log.error('Invalid timeout %s', this.params.timeout);
			}
			request.setTimeout(timeout, () => {
				requestFinished('Connection timed out');
			});
		}
		if (message) {
			request.write(message);
		}
		request.on('error', error => {
			requestFinished('Connection error: ' + error.message);
		});
		request.end();
	}

	/**
	 * Get a function that finishes one request and goes for the next.
	 */
	getRequestFinisher(id) {
		return (error, result) => {
			let errorCode = null;
			if (error) {
				log.debug('Connection %s failed: %s', id, error);
				if (result) {
					errorCode = result.statusCode;
				} else {
					errorCode = '-1';
				}
			} else {
				log.debug('Connection %s ended', id);
			}

			const elapsed = this.operation.latency.end(id, errorCode);
			if (elapsed < 0) {
				// not found or not running
				return;
			}
			const index = this.operation.latency.getRequestIndex(id);
			if (result) {
				result.requestElapsed = elapsed;
				result.requestIndex = index;
				result.instanceIndex = this.operation.instanceIndex;
			}
			let callback;
			if (!this.params.requestsPerSecond) {
				callback = this.makeRequest.bind(this);
			}
			this.operation.callback(error, result, callback);
		};
	}

	/**
	 * Get a function to connect the player.
	 */
	getConnect(id, callback) {
		let body = '';
		return connection => {
			log.debug('HTTP client connected to %s with id %s', this.params.url, id);
			connection.setEncoding('utf8');
			connection.on('data', chunk => {
				log.debug('Body: %s', chunk);
				body += chunk;
			});
			connection.on('error', error => {
				callback('Connection ' + id + ' failed: ' + error, '1');
			});
			connection.on('end', () => {
				const result = {
					host: connection.connection._host,
					path: connection.req.path,
					method: connection.req.method,
					statusCode: connection.statusCode,
					body: body,
					headers: connection.headers,
				};
				if (connection.statusCode >= 400) {
					return callback('Status code ' + connection.statusCode, result);
				}
				callback(null, result);
			});
		};
	}
}

function testHttpClient(callback) {
	const options = {
		url: 'http://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
	};
	exports.create({}, options);
	testing.success(callback);
}


/**
 * Run all tests.
 */
exports.test = function(callback) {
	testing.run([
		testHttpClient,
	], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1]) {
	exports.test(testing.show);
}

