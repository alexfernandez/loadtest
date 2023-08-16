import * as testing from 'testing'
import {execFile} from 'child_process'
import {join} from 'path'
import {loadTest, startServer} from '../index.js'

const PORT = 10408;


/**
 * Run an integration test.
 */
function testIntegration(callback) {
	const server = startServer({ port: PORT }, error => {
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
		loadTest(options, (error, result) => {
			if (error) {
				return callback(error);
			}
			server.close(error => {
				if (error) {
					return callback(error);
				}
				return callback(null, 'Test result: ' + JSON.stringify(result));
			});
		});
	});
}


/**
 * Run an integration test using configuration file.
 */
function testIntegrationFile(callback) {
	const server = startServer({ port: PORT }, error => {
		if (error) {
			return callback(error);
		}
		execFile('node',
			[join('./', 'bin', 'loadtest.js'), `http://localhost:${PORT}/`, '-n', '100'],
			(error, stdout) => {
				if (error) {
					return callback(error);
				}
				server.close(error => {
					if (error) {
						return callback(error);
					}
					return callback(null, 'Test result: ' + stdout);
				});
			});
	});
}



/**
 * Run an integration test.
 */
function testWSIntegration(callback) {
	const server = startServer({ port: PORT }, error => {
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
		loadTest(options, (error, result) => {
			if (error) {
				return callback(error);
			}
			server.close(error => {
				if (error) {
					return callback(error);
				}
				return callback(null, 'Test result: ' + JSON.stringify(result));
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
	const server = startServer(options, error => {
		if (error) {
			return callback(error);
		}
		options = {
			url: 'http://localhost:' + (PORT + 1),
			maxRequests: 10,
		};
		loadTest(options, (error, result) => {
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
export function test(callback) {
	testing.run([testIntegration, testIntegrationFile, testDelay, testWSIntegration], 4000, callback);
}

