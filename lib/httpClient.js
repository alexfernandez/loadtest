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
		this.stopped = false
		this.init();
	}

	/**
	 * Init options and message to send.
	 */
	init() {
		this.options = urlLib.parse(this.params.url);
		this.options.headers = this.params.headers || {}
		if (this.params.cert && this.params.key) {
			this.options.cert = this.params.cert;
			this.options.key = this.params.key;
		}
		this.options.agent = false;
		if (this.params.requestsPerSecond) {
			// rps for each client is total / concurrency (# of clients)
			this.options.requestsPerSecond = this.params.requestsPerSecond / this.params.concurrency
		}
		if (this.params.agentKeepAlive) {
			const KeepAlive = (this.options.protocol == 'https:') ? agentkeepalive.HttpsAgent : agentkeepalive.default;
			let maxSockets = 10;
			if (this.options.requestsPerSecond) {
				maxSockets += Math.floor(this.options.requestsPerSecond);
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
				throw new Error(`Unrecognized body: ${typeof this.params.body}`);
			}
			this.options.headers['Content-Type'] = this.params.contentType || 'text/plain';
		}
		if (this.params.cookies) {
			if (Array.isArray(this.params.cookies)) {
				this.options.headers.Cookie =  this.params.cookies.join('; ');
			} else if (typeof this.params.cookies == 'string') {
				this.options.headers.Cookie = this.params.cookies;
			} else {
				throw new Error(`Invalid cookies ${JSON.stringify(this.params.cookies)}, please use an array or a string`);
			}
		}
		addUserAgent(this.options.headers);
		if (this.params.secureProtocol) {
			this.options.secureProtocol = this.params.secureProtocol;
		}
		// adding proxy configuration
		if (this.params.proxy) {
			const proxy = this.params.proxy;
			const agent = new HttpsProxyAgent(proxy);
			this.options.agent = agent;
		}
		if (this.params.indexParam) {
			this.options.indexParamFinder = new RegExp(this.params.indexParam, 'g');
		}
		// Disable certificate checking
		if (this.params.insecure === true) {
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
		if (!this.options.requestsPerSecond) {
			return this.makeRequest();
		}
		const interval = 1000 / this.options.requestsPerSecond;
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
		const options = {...this.options, headers: {...this.options.headers}}
		const finishRequest = this.getRequestFinisher(id);
		this.customizeIndex(options)
		const request = this.getRequest(id, options, finishRequest)
		if (this.params.timeout) {
			const timeout = parseInt(this.params.timeout);
			if (!timeout) {
				console.error('Invalid timeout %s', this.params.timeout);
			}
			request.setTimeout(timeout, () => {
				finishRequest('Connection timed out');
			});
		}
		const message = this.getMessage(id, options)
		if (message) {
			request.write(message);
			options.headers['Content-Length'] = Buffer.byteLength(message);
		}
		request.on('error', error => {
			finishRequest('Connection error: ' + error.message);
		});
		request.end();
	}

	customizeIndex(options) {
		if (!this.options.indexParamFinder) {
			return
		}
		options.customIndex = this.getCustomIndex()
		options.path = this.options.path.replace(this.options.indexParamFinder, options.customIndex);
	}

	getCustomIndex() {
		if (this.options.indexParamCallback instanceof Function) {
			return this.options.indexParamCallback();
		}
		const customIndex = uniqueIndex
		uniqueIndex += 1
		return customIndex
	}

	getLib() {
		if (this.options.protocol == 'https:') {
			return https;
		}
		if (this.options.protocol == 'ws:') {
			return websocket;
		}
		return http;
	}

	getMessage(id, options) {
		if (!this.generateMessage) {
			return
		}
		const candidate = this.generateMessage(id);
		const message = typeof candidate === 'object' ? JSON.stringify(candidate) : candidate
		if (this.options.indexParamFinder) {
			return message.replace(this.options.indexParamFinder, options.customIndex);
		}
		return message
	}

	getRequest(id, options, finishRequest) {
		const lib = this.getLib()
		if (typeof this.params.requestGenerator == 'function') {
			const connect = this.getConnect(id, finishRequest, this.params.contentInspector)
			return this.params.requestGenerator(this.params, options, lib.request, connect);
		}
		return lib.request(options, this.getConnect(id, finishRequest, this.params.contentInspector));
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
			this.operation.finish(error, result, () => this.makeRequest());
		};
	}

	/**
	 * Get a function to connect the player.
	 */
	getConnect(id, finishRequest, contentInspector) {
		let body = '';
		return connection => {
			connection.setEncoding('utf8');
			connection.on('data', chunk => {
				body += chunk;
			});
			connection.on('error', error => {
				finishRequest('Connection ' + id + ' failed: ' + error, '1');
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
					return finishRequest('Status code ' + connection.statusCode, result);
				}
				if (result.customError) {
					return finishRequest('Custom error: ' + result.customError, result);
				}
				finishRequest(null, result);
			});
		};
	}
}

