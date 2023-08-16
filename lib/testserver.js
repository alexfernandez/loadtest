import * as http from 'http'
import {server as WebSocketServer} from 'websocket'
import * as util from 'util'
import * as net from 'net'
import {Latency} from './latency.js'

const PORT = 7357;
const LOG_HEADERS_INTERVAL_SECONDS = 1;


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
		this.debuggedTime = Date.now();
	}

	/**
	 * Start the server.
	 * An optional callback will be called after the server has started.
	 */
	start(callback) {
		if (this.options.socket) {
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
			console.info(`Listening on http://localhost:${this.port}/`);
			if (callback) {
				callback();
			}
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
				console.info('Peer %s disconnected', connection.remoteAddress);
			});
		});
		return this.server;
	}

	/**
	 * Log an error, or send to the callback if present.
	 */
	createError(message, callback) {
		if (!callback) {
			return console.error(message);
		}
		callback(message);
	}

	/**
	 * Listen to an incoming request.
	 */
	listen(request, response) {
		const id = this.latency.start();
		request.body = '';
		request.on('data', data => {
			request.body += data.toString();
		});
		request.on('end', () => {
			const now = Date.now();
			if (now - this.debuggedTime > LOG_HEADERS_INTERVAL_SECONDS * 1000) {
				this.debug(request);
				this.debuggedTime = now;
			}
			if (!this.options.delay) {
				return this.end(response, id);
			}
			setTimeout(() => {
				this.end(response, id);
			}, this.options.delay).unref();
		});
	}

	/**
	 * Listen on a socket.
	 */
	socketListen(socket) {
		socket.on('error', error => {
			console.error('socket error: %s', error);
			socket.end();
		});
		socket.on('data', data => this.readData(data));
	}

	/**
	 * Read some data off the socket.
	 */
	readData(data) {
		console.info('data: %s', data);
	}

	/**
	 * Debug headers and other interesting information: POST body.
	 */
	debug(request) {
		console.info('Headers for %s to %s: %s', request.method, request.url, util.inspect(request.headers));
		if (request.body) {
			console.info('Body: %s', request.body);
		}
	}

	/**
	 * End the response now.
	 */
	end(response, id) {
		if (this.shouldError()) {
			const code = this.options.error || 500;
			response.writeHead(code);
			response.end('ERROR');
		} else {
			response.end('OK');
		}
		this.latency.end(id);
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
			console.error('Invalid error percent %s', this.options.percent);
			return false;
		}
		return (Math.random() < percent / 100);
	}
}

/**
 * Start a test server. Options can contain:
 *	- port: the port to use, default 7357.
 *	- delay: wait the given milliseconds before answering.
 *	- quiet: do not log any messages (deprecated).
 *	- percent: give an error (default 500) on some % of requests.
 *	- error: set an HTTP error code, default is 500.
 * An optional callback is called after the server has started.
 */
export function startServer(options, callback) {
	const server = new TestServer(options);
	return server.start(callback);
}

