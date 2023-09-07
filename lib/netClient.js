import * as urlLib from 'url'
import * as net from 'net'
import * as querystring from 'querystring'
import {HighResolutionTimer} from './hrtimer.js'
import {addUserAgent} from './headers.js'
import * as HttpsProxyAgent from 'https-proxy-agent'


/**
 * Create a new HTTP client.
 * Seem parameters below.
 */
export function create(loadTest, options) {
	return new NetworkClient(loadTest, options);
}

/**
 * A client for an HTTP connection, using raw sockets. Constructor:
 *	- `loadTest`: an object with the following attributes:
 *		- latency: a variable to measure latency.
 *		- running: if the loadTest is running or not.
 *	- `options`: same options as exports.loadTest.
 */
class NetworkClient {
	constructor(loadTest, options) {
		this.loadTest = loadTest
		this.options = options
		this.stopped = false
		this.connection = null
		this.currentId = null
		this.init();
	}

	/**
	 * Init params and message to send.
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
		this.params.method = this.options.method || 'GET';
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
		this.params.headers.Connection = 'keep-alive'
		if (this.options.secureProtocol) {
			this.params.secureProtocol = this.options.secureProtocol;
		}
		// adding proxy configuration
		if (this.options.proxy) {
			const proxy = this.options.proxy;
			const agent = new HttpsProxyAgent(proxy);
			this.params.agent = agent;
		}
		// Disable certificate checking
		if (this.options.insecure === true) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		}
		this.params.request = this.createRequest()
		this.connect()
	}

	createRequest() {
		const lines = [`${this.params.method} ${this.params.path} HTTP/1.1`]
		for (const header in this.params.headers) {
			const value = this.params.headers[header]
			const line = `${header}: ${value}`
			lines.push(line)
		}
		lines.push(`\r\n`)
		return lines.join('\r\n')
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
		this.connection.end()
	}

	/**
	 * Make a single request to the server.
	 */
	makeRequest() {
		if (!this.loadTest.running) {
			return;
		}
		if (this.loadTest.options.maxRequests && this.loadTest.requests >= this.loadTest.options.maxRequests) return
		this.loadTest.requests += 1;

		const id = this.loadTest.latency.start();
		this.currentId = id
		this.connection.write(this.params.request)
	}

	connect() {
		this.connection = net.connect(this.params.port, this.params.hostname)
		this.connection.on('data', bulk => {
			const result = this.parseBulk(bulk)
			if (result.statusCode >= 400) {
				return this.finishRequest(`Status code ${result.statusCode}`, result);
			}
			this.finishRequest(null);
		});
		this.connection.on('error', error => {
			this.finishRequest(`Connection ${this.currentId} failed: ${error}`);
		});
		this.connection.on('end', () => {
			if (this.stopped) {
				return
			}
			this.connect()
		})
	}

	parseBulk(bulk) {
		const string = String(bulk)
		const lines = string.split('\n')
		const first = lines.shift()
		const parts = first.split(' ')
		if (parts.length < 2) {
			throw new Error(`Unexpected response ${first}`)
		}
		if (parts[0] != 'HTTP/1.1') {
			throw new Error(`Unexpected first word ${parts[0]}`)
		}
		const statusCode = parseInt(parts[1])
		if (!statusCode || statusCode < 100 || statusCode >= 600) {
			throw new Error(`Unexpected status code ${statusCode}`)
		}
		const result = {
			statusCode,
		}
		return result
	}

	getMessage(id) {
		if (!this.generateMessage) {
			return
		}
		const candidate = this.generateMessage(id);
		const message = typeof candidate === 'object' ? JSON.stringify(candidate) : candidate
		return message
	}

	finishRequest(error, result) {
		let errorCode = null;
		if (error) {
			console.error(error)
			if (result) {
				errorCode = result.statusCode;
			} else {
				errorCode = '-1';
			}
		}
		const elapsed = this.loadTest.latency.end(this.currentId, errorCode);
		if (elapsed < 0) {
			// not found or not running
			return;
		}
		if (result) {
			result.requestElapsed = elapsed;
		}
		this.loadTest.finishRequest(error, result, () => this.makeRequest());
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

