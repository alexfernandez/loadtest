import * as testing from 'testing'
import {execFile} from 'child_process'
import {join} from 'path'
import {loadTest, startServer} from '../index.js'

const PORT = 10408;
const serverOptions = {
	port: PORT,
	quiet: true,
}


/**
 * Run an integration test.
 */
function testIntegration(callback) {
	const server = startServer(serverOptions, error => {
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
			quiet: true,
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
	const server = startServer(serverOptions, error => {
		if (error) {
			return callback(error);
		}
		execFile('node',
			[join('./', 'bin', 'loadtest.js'), `http://localhost:${PORT}/`,
				'-n', '100', '--quiet'],
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
	const server = startServer(serverOptions, error => {
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
			quiet: true,
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
	const serverOptions = {
		port: PORT + 1,
		delay,
		quiet: true,
	};
	const server = startServer(serverOptions, error => {
		if (error) {
			return callback(error);
		}
		const options = {
			url: 'http://localhost:' + (PORT + 1),
			maxRequests: 10,
			quiet: true,
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

async function testPromise() {
	const server = await startServer(serverOptions)
	const options = {
		url: 'http://localhost:' + PORT,
		maxRequests: 100,
		concurrency: 10,
		method: 'POST',
		body: {
			hi: 'there',
		},
		quiet: true,
	};
	const result = await loadTest(options)
	await server.close()
	return 'Test result: ' + JSON.stringify(result)
}

/**
 * Run all tests.
 */
export function test(callback) {
	testing.run([
		testIntegration, testIntegrationFile, testDelay, testWSIntegration, testPromise,
	], 4000, callback);
}

