'use strict';

/**
 * Test server to load test.
 * (C) 2013 Alex Fernández.
 */


// requires
const testing = require('testing');
const http = require('http');
const WebSocketServer = require('websocket').server;
const util = require('util');
const net = require('net');
const Log = require('log');
const {Latency} = require('./latency.js');

// globals
const log = new Log('info');

// constants
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
		if (options.quiet) {
			log.level = 'notice';
		}
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
			log.info('Listening on port %s', this.port);
			if (callback) {
				callback();
			}
		});
		this.wsServer.on('request', request => {
			// explicity omitting origin check here.
			const connection = request.accept(null, request.origin);
			log.debug(' Connection accepted.');
			connection.on('message', message => {
				if (message.type === 'utf8') {
					log.debug('Received Message: ' + message.utf8Data);
					connection.sendUTF(message.utf8Data);
				} else if (message.type === 'binary') {
					log.debug('Received Binary Message of ' + message.binaryData.length + ' bytes');
					connection.sendBytes(message.binaryData);
				}
			});
			connection.on('close', () => {
				log.info('Peer %s disconnected', connection.remoteAddress);
			});
		});
		return this.server;
	}

	/**
	 * Log an error, or send to the callback if present.
	 */
	createError(message, callback) {
		if (!callback) {
			return log.error(message);
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
			log.error('socket error: %s', error);
			socket.end();
		});
		socket.on('data', data => this.readData(data));
	}

	/**
	 * Read some data off the socket.
	 */
	readData(data) {
		log.info('data: %s', data);
	}

	/**
	 * Debug headers and other interesting information: POST body.
	 */
	debug(request) {
		log.info('Headers for %s to %s: %s', request.method, request.url, util.inspect(request.headers));
		if (request.body) {
			log.info('Body: %s', request.body);
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
			log.error('Invalid error percent %s', this.options.percent);
			return false;
		}
		return (Math.random() < percent / 100);
	}
}

/**
 * Start a test server. Options can contain:
 *	- port: the port to use, default 7357.
 *	- delay: wait the given milliseconds before answering.
 *	- quiet: do not log any messages.
 *	- percent: give an error (default 500) on some % of requests.
 *	- error: set an HTTP error code, default is 500.
 * An optional callback is called after the server has started.
 * In this case the quiet option is enabled.
 */
exports.startServer = function(options, callback) {
	if (callback) {
		options.quiet = true;
	}
	const server = new TestServer(options);
	return server.start(callback);
};

function testStartServer(callback) {
	const options = {
		port: 10530,
	};
	const server = exports.startServer(options, error => {
		testing.check(error, 'Could not start server', callback);
		server.close(error => {
			testing.check(error, 'Could not stop server', callback);
			testing.success(callback);
		});
	});
}

/**
 * Run the tests.
 */
exports.test = function(callback) {
	testing.run([testStartServer], 5000, callback);
};

// start server if invoked directly
if (__filename == process.argv[1]) {
	exports.test(testing.show);
}

