import testing from 'testing'
import {loadTest} from '../lib/loadtest.js'
import {startServer} from '../lib/testserver.js'

const port = 10453;


function testBodyGenerator(callback) {
	const server = startServer({port, quiet: true}, error => {
		if (error) {
			return callback('Could not start test server');
		}
		const options = {
			url: `http://localhost:${port}`,
			requestsPerSecond: 1000,
			maxRequests: 100,
			concurrency: 10,
			postFile: 'sample/post-file.js',
			quiet: true,
		}
		loadTest(options, (error, result) => {
			if (error) {
				console.error(error)
				return callback(`Could not run load test with postFile: ${error.message}`);
			}
			server.close(error => {
				if (error) {
					return callback('Could not close test server');
				}
				return callback(null, 'bodyGenerator succeeded: ' + JSON.stringify(result));
			});
		});
	});
}

/**
 * Run all tests.
 */
export function test(callback) {
	testing.run([testBodyGenerator], 4000, callback);
}

