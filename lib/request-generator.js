'use strict';

const loadtest = require('./loadtest.js');
const testserver = require('./testserver.js');
const testing = require('testing');
const Log = require('log');

// globals
const log = new Log('info');

// constants
const PORT = 10453;


function testRequestGenerator(callback) {
	const server = testserver.startServer({port: PORT}, error => {
		if (error) {
			return callback('Could not start test server');
		}
		const options = {
			url: 'http://localhost:' + PORT,
			method: 'POST',
			requestsPerSecond: 20,
			maxRequests: 100,
			concurrency: 10,
			requestGenerator: (params, options, client, callback) => {
				const message = '{"hi": "ho"}';
				options.headers['Content-Length'] = message.length;
				options.headers['Content-Type'] = 'application/json';
				const request = client(options, callback);
				request.write(message);
				return request;
			},
		};
		loadtest.loadTest(options, (error, result) => {
			if (error) {
				return callback('Could not run load test with requestGenerator');
			}
			server.close(error => {
				if (error) {
					return callback('Could not close test server');
				}
				return callback(null, 'requestGenerator succeeded: ' + JSON.stringify(result));
			});
		});
	});
}

/**
 * Run all tests.
 */
exports.test = function(callback) {
	log.debug('Running all tests');
	testing.run([testRequestGenerator], 4000, callback);
};

// start load test if invoked directly
if (__filename == process.argv[1]) {
	exports.test(testing.show);
}

