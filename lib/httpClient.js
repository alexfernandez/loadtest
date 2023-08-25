import * as urlLib from 'url'
import * as http from 'http'
import * as https from 'https'
import * as querystring from 'querystring'
import * as websocket from 'websocket'
import {HighResolutionTimer} from './hrtimer.js'
import {addUserAgent} from './headers.js'
import * as agentkeepalive from 'agentkeepalive'
import * as HttpsProxyAgent from 'https-proxy-agent'


let uniqueIndex = 1

/**
 * Create a new HTTP client.
 * Seem parameters below.
 */
export function create(operation, options) {
	return new HttpClient(operation, options);
}

/**
 * A client for an HTTP connection. Constructor:
 *	- `operation`: an object with the following attributes:
 *		- latency: a variable to measure latency.
 *		- running: if the operation is running or not.
 *	- `options`: same options as exports.loadTest.
 */
class HttpClient {
	constructor(operation, options) {
		this.operation = operation
		this.options = options
		this.stopped = false
		this.init();
	}

	/**
	 * Init and message to send.
	 */
	init() {
		this.params = urlLib.parse(this.options.url);
		this.params.headers = this.options.headers || {}
		if (this.options.cert && this.options.key) {
			this.params.cert = this.options.cert;
			this.params.key = this.options.key;
		}
		this.params.agent = false;
		if (this.options.requestsPerSecond) {
			// rps for each client is total / concurrency (# of clients)
			this.params.requestsPerSecond = this.options.requestsPerSecond / this.options.concurrency
		}
		if (this.options.agentKeepAlive) {
			const KeepAlive = (this.params.protocol == 'https:') ? agentkeepalive.HttpsAgent : agentkeepalive.default;
			let maxSockets = 10;
			if (this.params.requestsPerSecond) {
				maxSockets += Math.floor(this.params.requestsPerSecond);
			}
			this.params.agent = new KeepAlive({
				maxSockets: maxSockets,
				maxKeepAliveRequests: 0, // max requests per keepalive socket, default is 0, no limit
				maxKeepAliveTime: 30000  // keepalive for 30 seconds
			});
		}
		if (this.options.method) {
			this.params.method = this.options.method;
		}
		if (this.options.body) {
			if (typeof this.options.body == 'string') {
				this.generateMessage = () => this.options.body;
			} else if (typeof this.options.body == 'object') {
				if (this.options.contentType === 'application/x-www-form-urlencoded') {
					this.options.body = querystring.stringify(this.options.body);
				}
				this.generateMessage = () => this.options.body;
			} else if (typeof this.options.body == 'function') {
				this.generateMessage = this.options.body;
			} else {
				throw new Error(`Unrecognized body: ${typeof this.options.body}`);
			}
			this.params.headers['Content-Type'] = this.options.contentType || 'text/plain';
		}
		if (this.options.cookies) {
			if (Array.isArray(this.options.cookies)) {
				this.params.headers.Cookie =  this.options.cookies.join('; ');
			} else if (typeof this.options.cookies == 'string') {
				this.params.headers.Cookie = this.options.cookies;
			} else {
				throw new Error(`Invalid cookies ${JSON.stringify(this.options.cookies)}, please use an array or a string`);
			}
		}
		addUserAgent(this.params.headers);
		if (this.options.secureProtocol) {
			this.params.secureProtocol = this.options.secureProtocol;
		}
		// adding proxy configuration
		if (this.options.proxy) {
			const proxy = this.options.proxy;
			const agent = new HttpsProxyAgent(proxy);
			this.params.agent = agent;
		}
		if (this.options.indexParam) {
			this.params.indexParamFinder = new RegExp(this.options.indexParam, 'g');
		}
		// Disable certificate checking
		if (this.options.insecure === true) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		}
	}

	/**
	 * Start the HTTP client.
	 */
	start() {
		if (this.stopped) {
			// solves testing issue: with requestsPerSecond clients are started at random,
			// so sometimes they are stopped before they have even started
			return
		}
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
		this.stopped = true
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
		const params = {...this.params, headers: {...this.params.headers}}
		const finishRequest = this.getRequestFinisher(id);
		this.customizeIndex(params)
		const request = this.getRequest(id, params, finishRequest)
		if (this.options.timeout) {
			const timeout = parseInt(this.options.timeout);
			if (!timeout) {
				console.error('Invalid timeout %s', this.options.timeout);
			}
			request.setTimeout(timeout, () => {
				finishRequest('Connection timed out');
			});
		}
		const message = this.getMessage(id, params)
		if (message) {
			request.write(message);
			params.headers['Content-Length'] = Buffer.byteLength(message);
		}
		request.on('error', error => {
			finishRequest('Connection error: ' + error.message);
		});
		request.end();
	}

	customizeIndex(params) {
		if (!this.params.indexParamFinder) {
			return
		}
		params.customIndex = this.getCustomIndex()
		params.path = this.params.path.replace(this.params.indexParamFinder, params.customIndex);
	}

	getCustomIndex() {
		if (this.params.indexParamCallback instanceof Function) {
			return this.params.indexParamCallback();
		}
		const customIndex = uniqueIndex
		uniqueIndex += 1
		return customIndex
	}

	getMessage(id, params) {
		if (!this.generateMessage) {
			return
		}
		const candidate = this.generateMessage(id);
		const message = typeof candidate === 'object' ? JSON.stringify(candidate) : candidate
		if (this.params.indexParamFinder) {
			return message.replace(this.params.indexParamFinder, params.customIndex);
		}
		return message
	}

	getRequest(id, params, finishRequest) {
		const lib = this.getLib()
		const connect = this.getConnect(id, finishRequest)
		if (typeof this.options.requestGenerator == 'function') {
			return this.options.requestGenerator(this.options, params, lib.request, connect)
		}
		return lib.request(params, connect)
	}

	getLib() {
		if (this.params.protocol == 'https:') {
			return https;
		}
		if (this.params.protocol == 'ws:') {
			return websocket;
		}
		return http;
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
			this.operation.finishRequest(error, result, () => this.makeRequest());
		};
	}

	/**
	 * Get a function to connect the player.
	 */
	getConnect(id, finishRequest) {
		const bodyBuffers = []
		return connection => {
			connection.on('data', chunk => {
				bodyBuffers.push(chunk)
			});
			connection.on('error', error => {
				finishRequest('Connection ' + id + ' failed: ' + error, '1');
			});
			connection.on('end', () => {
				const body = Buffer.concat(bodyBuffers).toString()
				const result = this.createResult(connection, body)
				if (this.options.contentInspector) {
					this.options.contentInspector(result)
				}
				if (connection.statusCode >= 400) {
					return finishRequest('Status code ' + connection.statusCode, result);
				}
				if (result?.customError) {
					return finishRequest('Custom error: ' + result.customError, result);
				}
				finishRequest(null, result);
			});
		};
	}

	createResult(connection, body) {
		if (!this.options.statusCallback && !this.options.contentInspector) {
			return null
		}
		const client = connection.connection || connection.client
		const result = {
			host: client._host,
			path: connection.req.path,
			method: connection.req.method,
			statusCode: connection.statusCode,
			body,
			headers: connection.headers,
		};
		if (connection.req.labels) {
			result.labels = connection.req.labels
		}
		return result
	}
}

