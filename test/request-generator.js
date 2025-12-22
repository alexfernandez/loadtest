import testing from 'testing'
import {loadTest} from '../lib/loadtest.js'
import {startServer} from '../lib/testserver.js'

const port = 10453;


function testRequestGenerator(callback) {
	const server = startServer({
		port,
		quiet: true,
		shouldErrorCustom: (request) => (
			request.body !== '{"hi": "ho"}' ||
			request.headers['content-type'] !== 'application/json' ||
			request.headers['content-length'] !== request.body.length.toString() ||
			request.headers['x-test-header'] !== 'request-generator-test'
		),
	}, error => {
		if (error) {
			return callback('Could not start test server');
		}
		const options = {
			url: `http://localhost:${port}`,
			method: 'POST',
			requestsPerSecond: 1000,
			maxRequests: 100,
			concurrency: 10,
			requestGenerator: (params, options, client, callback) => {
				const message = '{"hi": "ho"}';
				options.headers['Content-Length'] = message.length;
				options.headers['Content-Type'] = 'application/json';
				options.headers['x-test-header'] = 'request-generator-test';
				const request = client(options, callback);
				request.write(message);
				return request;
			},
			quiet: true,
		};
		loadTest(options, (error, result) => {
			if (error) {
				console.error(error)
				return callback(`Could not run load test with requestGenerator: ${error.message}`);
			}
			server.close(error => {
				if (error) {
					return callback('Could not close test server');
				}
				if (result.totalErrors > 0) {
					return callback(`There were ${result.totalErrors} errors in the load test`);
				}
				return callback(null, 'requestGenerator succeeded: ' + JSON.stringify(result));
			});
		});
	});
}

/**
 * Run all tests.
 */
export function test(callback) {
	testing.run([testRequestGenerator], 4000, callback);
}

