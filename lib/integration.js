'use strict';

/**
 * API usage examples
 * (C) 2013 Alex Fernández.
 */


// requires
const loadtest = require('./loadtest.js');
const testserver = require('./testserver.js');
const testing = require('testing');
const Log = require('log');
const { execFile } = require('child_process');
const { join } = require('path');

// globals
const log = new Log('info');

// constants
const PORT = 10408;


/**
 * Run an integration test.
 */
function testIntegration(callback) {
	const server = testserver.startServer({ port: PORT }, error => {
		if (error) {
			return callback(error);
		}
		const options = {
			url: 'http://localhost:' + PORT,
			maxRequests: 100,
			concurrency: 10,
			method: 'POST',
			body: {
				hi: 'there',
			},
		};
		loadtest.loadTest(options, (error, result) => {
			if (error) {
				return callback(error);
			}
			server.close(error => {
				if (error) {
					return callback(error);
				}
				return callback(null, 'Test results: ' + JSON.stringify(result));
			});
		});
	});
}


/**
 * Run an integration test using configuration file.
 */
function testIntegrationFile(callback) {
	const server = testserver.startServer({ port: PORT }, error => {
		if (error) {
			return callback(error);
		}
		execFile('node',
			[join(__dirname, '..', 'bin', 'loadtest.js'), 'http://localhost:' + PORT],
			{ cwd: join(__dirname, '..', 'test') },
			(error, stdout) => {
				if (error) {
					return callback(error);
				}
				server.close(error => {
					if (error) {
						return callback(error);
					}
					return callback(null, 'Test results: ' + stdout);
				});
			});
	});
}



/**
 * Run an integration test.
 */
function testWSIntegration(callback) {
	const server = testserver.startServer({ port: PORT }, error => {
		if (error) {
			return callback(error);
		}
		const options = {
			url: 'ws://localhost:' + PORT,
			maxRequests: 10,
			concurrency: 10,
			body: {
				/*
				const update = {
				requestId: Math.floor(Math.random() * 0x100000000).toString(16),
				type: 'ping',
				};*/
				type: 'ping',
				hi: 'there',
			},
		};
		loadtest.loadTest(options, (error, result) => {
			if (error) {
				return callback(error);
			}
			server.close(error => {
				if (error) {
					return callback(error);
				}
				return callback(null, 'Test results: ' + JSON.stringify(result));
			});
		});
	});
}

/**
 * Run a delayed test.
 */
function testDelay(callback) {
	const delay = 10;
	let options = {
		port: PORT + 1,
		delay: delay,
	};
	const server = testserver.startServer(options, error => {
		if (error) {
			return callback(error);
		}
		options = {
			url: 'http://localhost:' + (PORT + 1),
			maxRequests: 10,
		};
		loadtest.loadTest(options, (error, result) => {
			if (error) {
				return callback(error);
			}
			server.close(error => {
				if (error) {
					return callback(error);
				}
				testing.assertEquals(result.totalRequests, 10, 'Invalid total requests', callback);
				testing.assert(result.meanLatencyMs >= delay, 'Delay should be higher than %s, not %s', delay, result.meanLatencyMs, callback);
				callback(null, result);
			});
		});
	});
}

/**
 * Run all tests.
 */
exports.test = function(callback) {
	log.debug('Running all tests');
	testing.run([testIntegration, testIntegrationFile, testDelay, testWSIntegration], 4000, callback);
};

// start load test if invoked directly
if (__filename == process.argv[1]) {
	exports.test(testing.show);
}

