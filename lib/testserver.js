import * as http from 'http'
import {server as WebSocketServer} from 'websocket'
import * as util from 'util'
import * as net from 'net'
import {Latency} from './latency.js'
import {readFileSync} from 'fs'

const PORT = 7357;
const LOG_HEADERS_INTERVAL_MS = 5000;


/**
 * Start a test server. Parameters:
 * - `options`, can contain:
 *	 - port: the port to use, default 7357.
 *	 - delay: wait the given milliseconds before answering.
 *	 - quiet: do not log any messages.
 *	 - percent: give an error (default 500) on some % of requests.
 *	 - error: set an HTTP error code, default is 500.
 *	 - logger: function to log all incoming requests.
 *	 - body: to return in requests.
 *	 - file: to read and return as body.
 * - `callback`: optional callback, called after the server has started.
 *   If not present will return a promise.
 */
export function startServer(options, callback) {
	const server = new TestServer(options);
	if (callback) {
		return server.start(callback)
	}
	return new Promise((resolve, reject) => {
		server.start((error, result) => {
			if (error) return reject(error)
			return resolve(result)
		})
	})
}

/**
 * A test server, with the given options (see below on startServer()).
 */
class TestServer {
	constructor(options) {
		this.options = options
		this.port = options.port || PORT;
		this.server = null;
		this.wsServer = null;
		this.latency = new Latency({});
		this.totalRequests = 0
		this.partialRequests = 0
		this.debuggedTime = Date.now();
		this.body = options.body || 'OK'
		if (options.file) {
			this.body = readFileSync(options.file)
		}
	}

	/**
	 * Start the server.
	 * The callback parameter will be called after the server has started.
	 */
	start(callback) {
		if (this.options.tcp) {
			// just for internal debugging
			this.server = net.createServer(() => this.socketListen());
		} else {
			this.server = http.createServer((request, response) => this.listen(request, response));

			this.wsServer = new WebSocketServer({
				httpServer: this.server,
				// OK only because this is for testing only
				autoAcceptConnections: false,
			});
		}
		this.server.on('error', error => {
			if (error.code == 'EADDRINUSE') {
				return this.createError('Port ' + this.port + ' in use, please free it and retry again', callback);
			}
			return this.createError('Could not start server on port ' + this.port + ': ' + error, callback);
		});
		this.server.listen(this.port, () => {
			if (!this.options.quiet) console.info(`Listening on http://localhost:${this.port}/`)
			callback(null, this)
		});
		this.wsServer.on('request', request => {
			// explicity omitting origin check here.
			const connection = request.accept(null, request.origin);
			connection.on('message', message => {
				if (message.type === 'utf8') {
					connection.sendUTF(message.utf8Data);
				} else if (message.type === 'binary') {
					connection.sendBytes(message.binaryData);
				}
			});
			connection.on('close', () => {
				if (!this.options.quiet) console.info('Peer %s disconnected', connection.remoteAddress);
			});
		});
		return this
	}

	/**
	 * Log an error, or send to the callback if present.
	 */
	createError(message, callback) {
		callback(message);
	}

	/**
	 * Listen to an incoming request.
	 */
	listen(request, response) {
		const id = this.latency.begin();
		const bodyBuffers = []
		request.on('data', data => {
			bodyBuffers.push(data)
		});
		request.on('error', () => {
			// ignore request
			response.end()
			this.latency.end(id, -1);
		})
		request.on('end', () => {
			request.body = Buffer.concat(bodyBuffers).toString();
			this.partialRequests += 1
			this.totalRequests += 1
			const elapsedMs = Date.now() - this.debuggedTime
			if (elapsedMs > LOG_HEADERS_INTERVAL_MS) {
				this.debug(request, elapsedMs);
			}
			if (!this.options.delay) {
				return this.end(request, response, id);
			}
			setTimeout(() => {
				this.end(request, response, id);
			}, this.options.delay).unref();
		});
	}

	/**
	 * Listen on a socket.
	 */
	socketListen(socket) {
		socket.on('error', error => {
			if (!this.options.quiet) console.error('socket error: %s', error);
			socket.end();
		});
		socket.on('data', data => this.readData(data));
	}

	/**
	 * Read some data off the socket.
	 */
	readData(data) {
		if (!this.options.quiet) console.info('data: %s', data);
	}

	/**
	 * Debug headers and other interesting information: POST body.
	 */
	debug(request) {
		if (this.options.quiet) return
		const headers = util.inspect(request.headers)
		const now = Date.now()
		const elapsedMs = now - this.debuggedTime
		const rps = (this.partialRequests / elapsedMs) * 1000
		if (rps > 1) {
			console.info(`Requests per second: ${rps.toFixed(0)}`)
		}
		console.info(`Headers for ${request.method} to ${request.url}: ${headers}`)
		if (request.body) {
			console.info(`Body: ${request.body}`);
		}
		this.debuggedTime = now;
		this.partialRequests = 0
	}

	/**
	 * End the response now.
	 */
	end(request, response, id) {
		if (this.shouldError()) {
			const code = this.options.error || 500;
			response.writeHead(code);
			response.end('ERROR');
		} else {
			response.end(this.body);
		}
		this.latency.end(id);
		if (this.options.logger) {
			this.options.logger(request, response)
		}
	}

	shouldError() {
		if (!this.options.percent) {
			if (this.options.error) {
				return true;
			}
			return false;
		}
		const percent = parseInt(this.options.percent, 10);
		if (!percent) {
			if (!this.options.quiet) console.error('Invalid error percent %s', this.options.percent);
			return false;
		}
		return (Math.random() < percent / 100);
	}

	close(callback) {
		if (callback) {
			this.server.close(callback)
			return
		}
		return this.server.close()
	}
}

