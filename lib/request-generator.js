'use strict';

var loadtest = require('./loadtest.js');
var testserver = require('./testserver.js');
var testing = require('testing');
var Log = require('log');

// globals
var log = new Log('info');

// constants
var PORT = 10453;


function testRequestGenerator(callback)
{
	var server = testserver.startServer({port: PORT}, function(error)
	{
		testing.check(error, 'Could not start test server', callback);
		var options = {
			url: 'http://localhost:' + PORT,
			method: 'POST',
			requestperSecond: 20,
			maxRequests: 100,
			concurrency: 10,
			requestGenerator: function(params, options, client, callback)
			{
				var message = '{"hi": "ho"}';
				var request = client(options, callback);
				options.headers['Content-Length'] = message.length;
				options.headers['Content-Type'] = 'application/json';
				request.write(message);
				request.end();
			},
		};
		loadtest.loadTest(options, function(error, result)
		{
			testing.check(error, 'Could not run load test with requestGenerator', callback);
			server.close(function(error)
			{
				testing.check(error, 'Could not close test server', callback);
				testing.success('requestGenerator succeeded: ' + JSON.stringify(result), callback);
			});
		});
	});
}

/**
 * Run all tests.
 */
exports.test = function(callback)
{
	log.debug('Running all tests');
	testing.run([testRequestGenerator], 4000, callback);
};

// start load test if invoked directly
if (__filename == process.argv[1])
{
exports.test(testing.show);
}

