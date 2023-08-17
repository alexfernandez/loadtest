import * as urlLib from 'url'
import * as http from 'http'
import * as https from 'https'
import * as querystring from 'querystring'
import * as websocket from 'websocket'
import {HighResolutionTimer} from './hrtimer.js'
import {addUserAgent} from './headers.js'
import * as agentkeepalive from 'agentkeepalive'
import * as HttpsProxyAgent from 'https-proxy-agent'


/**
 * Create a new HTTP client.
 * Seem parameters below.
 */
export function create(operation, params) {
	return new HttpClient(operation, params);
}

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
			const KeepAlive = (this.options.protocol == 'https:') ? agentkeepalive.HttpsAgent : agentkeepalive.default;
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
				this.generateMessage = () => this.params.body;
			} else if (typeof this.params.body == 'object') {
				if (this.params.contentType === 'application/x-www-form-urlencoded') {
					this.params.body = querystring.stringify(this.params.body);
				}
				this.generateMessage = () => this.params.body;
			} else if (typeof this.params.body == 'function') {
				this.generateMessage = this.params.body;
			} else {
				console.error('Unrecognized body: %s', typeof this.params.body);
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
		addUserAgent(this.options.headers);
		if (this.params.secureProtocol) {
			this.options.secureProtocol = this.params.secureProtocol;
		}
	}

	/**
	 * Start the HTTP client.
	 */
	start() {
		if (!this.params.requestsPerSecond) {
			return this.makeRequest();
		}
		const interval = 1000 / this.params.requestsPerSecond;
		this.requestTimer = new HighResolutionTimer(interval, () => this.makeRequest());
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
			request = this.params.requestGenerator(this.params, this.options, lib.request, this.getConnect(id, requestFinished, this.params.contentInspector));
		} else {
			request = lib.request(this.options, this.getConnect(id, requestFinished, this.params.contentInspector));
		}
		if (this.params.timeout) {
			const timeout = parseInt(this.params.timeout);
			if (!timeout) {
				console.error('Invalid timeout %s', this.params.timeout);
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
				if (result) {
					errorCode = result.statusCode;
					if (result.customErrorCode !== undefined) {
						errorCode = errorCode + ":" + result.customErrorCode
					}
				} else {
					errorCode = '-1';
				}
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
	getConnect(id, callback, contentInspector) {
		let body = '';
		return connection => {
			connection.setEncoding('utf8');
			connection.on('data', chunk => {
				body += chunk;
			});
			connection.on('error', error => {
				callback('Connection ' + id + ' failed: ' + error, '1');
			});
			connection.on('end', () => {
				const client = connection.connection || connection.client
				const result = {
					host: client._host,
					path: connection.req.path,
					method: connection.req.method,
					statusCode: connection.statusCode,
					body: body,
					headers: connection.headers,
				};
				if (connection.req.labels) {
					result.labels = connection.req.labels
				}
				if (contentInspector) {
					contentInspector(result)
				}
				if (connection.statusCode >= 400) {
					return callback('Status code ' + connection.statusCode, result);
				}
				if (result.customError) {
					return callback('Custom error: ' + result.customError, result);
				}
				callback(null, result);
			});
		};
	}
}

