import * as urlLib from 'url'
import * as net from 'net'
import * as querystring from 'querystring'
import {addUserAgent} from './headers.js'
import {Parser} from './parser.js'

const forbiddenOptions = [
	'indexParam', 'statusCallback', 'requestGenerator'
]


/**
 * A client for an HTTP connection, using TCP sockets. Constructor:
 *	- `loadTest`: an object with the following attributes:
 *		- `latency`: a variable to measure latency.
 *		- `options`: same options as exports.loadTest.
 *		- `running`: if the loadTest is running or not.
 */
export class TcpClient {
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
		this.params.method = this.options.method || 'GET';
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
		for (const option of forbiddenOptions) {
			if (this.options[option]) {
				throw new Error(`${option} not supported with TCP sockets`)
			}
		}
	}

	createRequest() {
		const body = this.generateBody()
		if (body?.length) {
			this.params.headers['Content-Type'] = this.options.contentType || 'text/plain';
			this.params.headers['Content-Length'] = Buffer.byteLength(body)
		}
		const lines = [`${this.params.method} ${this.params.path} HTTP/1.1`]
		for (const header in this.params.headers) {
			const value = this.params.headers[header]
			const line = `${header}: ${value}`
			lines.push(line)
		}
		lines.push('')
		lines.push(body)
		const text = lines.join('\r\n')
		return Buffer.from(text)
	}

	generateBody() {
		if (!this.options.body) {
			return ''
		}
		if (typeof this.options.body == 'string') {
			return this.options.body
		} else if (typeof this.options.body == 'object') {
			if (this.options.contentType === 'application/x-www-form-urlencoded') {
				return querystring.stringify(this.options.body);
			}
			return JSON.stringify(this.options.body)
		} else {
			throw new Error(`Unrecognized body: ${typeof this.options.body}`);
		}
	}

	/**
	 * Start the HTTP client.
	 */
	start() {
		if (!this.options.requestsPerSecond) {
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
		if (!this.running) {
			return
		}
		this.connect()
		this.parser = new Parser(this.params.method)
		const id = this.latency.begin();
		this.currentId = id
		this.connection.write(this.params.request)
	}

	connect() {
		if (this.connection && !this.connection.destroyed) {
			return
		}
		this.connection = net.connect(parseInt(this.params.port), this.params.hostname)
		this.connection.on('data', data => {
			this.parser.addPacket(data)
			if (this.parser.finished) {
				this.finishRequest(null);
			}
		});
		this.connection.on('error', error => {
			this.finishRequest(`Connection ${this.currentId} failed: ${error}`);
			this.connection = null
		});
		this.connection.on('end', () => {
			this.connection = null
			if (this.parser) {
				// connection waiting for a response; remake
				this.makeRequest()
			}
		})
	}

	finishRequest(error) {
		// reset parser for next request
		const parser = this.parser
		this.parser = null
		if (!this.running) {
			return
		}
		let errorCode = null;
		if (parser.statusCode >= 400) {
			errorCode = parser.statusCode
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
		if (this.options.maxRequests && this.latency.totalRequests >= this.options.maxRequests) {
			this.loadTest.stop()
			return;

		}
		this.makeRequest()
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

