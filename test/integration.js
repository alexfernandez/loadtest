import * as testing from 'testing'
import {execFile} from 'child_process'
import {join} from 'path'
import {loadTest, startServer} from '../index.js'

const port = 10408;
const serverOptions = {
	port,
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
			url: `http://localhost:${port}`,
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
			[join('./', 'bin', 'loadtest.js'), `http://localhost:${port}/`,
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
			url: `ws://localhost:${port}`,
			maxRequests: 100,
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
		port: port + 1,
		delay,
		quiet: true,
	};
	const server = startServer(serverOptions, error => {
		if (error) {
			return callback(error);
		}
		const options = {
			url: 'http://localhost:' + (port + 1),
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
		url: `http://localhost:${port}`,
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

async function testIndexParam() {
	const urls = new Map()
	const bodies = new Map()
	function logger(request) {
		if (urls.has(request.url)) {
			throw new Error(`Duplicated url ${request.url}`)
		}
		urls.set(request.url, true)
		if (bodies.has(request.body)) {
			throw new Error(`Duplicated body ${request.body}`)
		}
		bodies.set(request.body, true)
	}
	const server = await startServer({logger, ...serverOptions})
	const options = {
		url: `http://localhost:${port}/?param=index`,
		maxRequests: 100,
		concurrency: 10,
		postBody: {
			hi: 'my_index',
		},
		indexParam: 'index',
		quiet: true,
	};
	await loadTest(options)
	await server.close()
}

async function testStatusCallback() {
	let calls = 0
	const server = await startServer(serverOptions)
	const options = {
		url: `http://localhost:${port}/`,
		maxRequests: 100,
		concurrency: 10,
		postBody: {
			hi: 'hey',
		},
		quiet: true,
		statusCallback: (error, result) => {
			testing.assertEquals(result.statusCode, 200, 'Should receive status 200')
			calls += 1
		}
	};
	const result = await loadTest(options)
	testing.assertEquals(result.totalRequests, 100, 'Should have 100 requests')
	testing.assertEquals(calls, 100, 'Should have 100 calls')
	await server.close()
}

async function testTcpClient() {
	const server = await startServer(serverOptions)
	const options = {
		url: `http://localhost:${port}`,
		maxRequests: 100,
		method: 'POST',
		body: {
			hi: 'there',
		},
		quiet: true,
		tcp: true,
	};
	const result = await loadTest(options)
	await server.close()
	return 'Test result: ' + JSON.stringify(result)
}

async function testTcpNoServer() {
	const options = {
		url: `http://localhost:${port}`,
		maxRequests: 100,
		rps: 1000,
		method: 'POST',
		body: {
			hi: 'there',
		},
		quiet: true,
		tcp: true,
	};
	const result = await loadTest(options)
	return 'Test result: ' + JSON.stringify(result)
}

/**
 * Run all tests.
 */
export function test(callback) {
	testing.run([
		testIntegration, testIntegrationFile, testDelay, testWSIntegration,
		testPromise, testIndexParam, testStatusCallback, testTcpClient,
		testTcpNoServer,
	], 4000, callback);
}

