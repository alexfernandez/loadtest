import * as urlLib from 'url'
import * as net from 'net'
import * as querystring from 'querystring'
import {addUserAgent} from './headers.js'
import {Parser} from './parser.js'


/**
 * A client for an HTTP connection, using raw sockets. Constructor:
 *	- `loadTest`: an object with the following attributes:
 *		- `latency`: a variable to measure latency.
 *		- `options`: same options as exports.loadTest.
 *		- `running`: if the loadTest is running or not.
 */
export class NetworkClient {
	constructor(loadTest) {
		this.loadTest = loadTest
		this.latency = loadTest.latency
		this.options = loadTest.options
		this.running = true
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
		this.params.request = this.createRequest()
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
		if (!this.running) {
			// solves testing issue: with requestsPerSecond clients are started at random,
			// so sometimes they are stopped before they have even started
			return
		}
		if (!this.params.requestsPerSecond) {
			return this.makeRequest();
		}
	}

	/**
	 * Stop the HTTP client.
	 */
	stop() {
		this.running = false
		if (this.connection) {
			this.connection.end()
		}
	}

	/**
	 * Make a single request to the server.
	 */
	makeRequest() {
		this.connect()
		if (this.loadTest.checkStop()) {
			return;
		}
		this.parser = new Parser(this.params.method)
		const id = this.latency.begin();
		this.currentId = id
		this.connection.write(this.params.request)
	}

	connect() {
		if (!this.running) {
			return
		}
		if (this.connection && !this.connection.destroyed) {
			return
		}
		this.connection = net.connect(this.params.port, this.params.hostname)
		this.connection.on('data', data => {
			this.parser.addPacket(data)
			if (this.parser.finished) {
				this.finishRequest(null);
			}
		});
		this.connection.on('error', error => {
			this.finishRequest(`Connection ${this.currentId} failed: ${error}`);
		});
		this.connection.on('end', () => {
		})
	}

	getMessage(id) {
		if (!this.generateMessage) {
			return
		}
		const candidate = this.generateMessage(id);
		const message = typeof candidate === 'object' ? JSON.stringify(candidate) : candidate
		return message
	}

	finishRequest(error) {
		if (!this.running) {
			return
		}
		let errorCode = null;
		if (this.parser.statusCode >= 400) {
			errorCode = this.parser.statusCode
		}
		if (error) {
			// console.error(error)
			errorCode = '-1';
		}
		const elapsed = this.latency.end(this.currentId, errorCode);
		if (elapsed < 0) {
			// not found or not running
			return;
		}
		this.loadTest.pool.finishRequest(this, null, error);
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

