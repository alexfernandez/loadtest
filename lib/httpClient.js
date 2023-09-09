import * as urlLib from 'url'
import * as http from 'http'
import * as https from 'https'
import * as querystring from 'querystring'
import * as websocket from 'websocket'
import {addUserAgent} from './headers.js'
import * as agentkeepalive from 'agentkeepalive'
import * as HttpsProxyAgent from 'https-proxy-agent'

http.globalAgent.maxSockets = 1000;
https.globalAgent.maxSockets = 1000;
let uniqueIndex = 1


/**
 * A client for an HTTP connection. Constructor:
 *	- `loadTest`: an object with the following attributes:
 *		- latency: a variable to measure latency.
 *		- running: if the loadTest is running or not.
 *	- `options`: same options as exports.loadTest.
 */
export class HttpClient {
	constructor(loadTest) {
		this.loadTest = loadTest
		this.latency = loadTest.latency
		this.options = loadTest.options
		this.running = true
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
		if (this.options.agentKeepAlive) {
			const KeepAlive = (this.params.protocol == 'https:') ? agentkeepalive.HttpsAgent : agentkeepalive.default;
			let maxSockets = 10;
			this.params.agent = new KeepAlive({
				maxSockets,
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
		return this.makeRequest();
	}

	/**
	 * Stop the HTTP client.
	 */
	stop() {
		this.running = false
	}

	/**
	 * Make a single request to the server.
	 */
	makeRequest() {
		if (!this.running) {
			return
		}
		if (!this.latency.shouldSend()) {
			return
		}
		const id = this.latency.begin();
		const params = {...this.params, headers: {...this.params.headers}}
		this.customizeIndex(params)
		const request = this.getRequest(id, params)
		if (this.options.timeout) {
			const timeout = parseInt(this.options.timeout);
			if (!timeout) {
				console.error(`Invalid timeout ${this.options.timeout}`);
			}
			request.setTimeout(timeout, () => {
				this.finishRequest(id, 'Connection timed out');
			});
		}
		const message = this.getMessage(id, params)
		if (message) {
			request.write(message);
			params.headers['Content-Length'] = Buffer.byteLength(message);
		}
		request.on('error', error => {
			this.finishRequest(id, `Connection error: ${error.message}`);
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

	getRequest(id, params) {
		const lib = this.getLib()
		if (typeof this.options.requestGenerator == 'function') {
			return this.options.requestGenerator(this.options, params, lib.request, connection => this.connect(connection, id))
		}
		return lib.request(params, connection => this.connect(connection, id))
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

	finishRequest(id, error, result) {
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
		const elapsed = this.latency.end(id, errorCode);
		if (elapsed < 0) {
			// not found or not running
			return;
		}
		if (result) {
			result.requestElapsed = elapsed;
		}
		this.loadTest.pool.finishRequest(this, result, error);
	}

	connect(connection, id) {
		const bodyBuffers = []
		connection.on('data', chunk => {
			bodyBuffers.push(chunk)
		});
		connection.on('error', error => {
			this.finishRequest(id, `Connection ${id} failed: ${error}`);
		});
		connection.on('end', () => {
			const body = Buffer.concat(bodyBuffers).toString()
			const result = this.createResult(connection, body)
			if (this.options.contentInspector) {
				this.options.contentInspector(result)
			}
			if (connection.statusCode >= 400) {
				return this.finishRequest(id, `Status code ${connection.statusCode}`, result);
			}
			if (result?.customError) {
				return this.finishRequest(id, `Custom error: ${result.customError}`, result);
			}
			this.finishRequest(id, null, result);
		});
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

