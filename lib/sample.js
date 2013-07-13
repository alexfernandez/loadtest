'use strict';

/**
 * API usage examples
 * (C) 2013 Alex Fernández.
 */


// requires
var loadtest = require('./loadtest.js');
var testserver = require('./testserver.js');
var prototypes = require('./prototypes.js');
var testing = require('testing');
var Log = require('log');

// globals
var log = new Log('info');

// constants
var PORT = 10408;


/**
 * Run the load test.
 */
function loadTest(callback)
{
	var options = {
		url: 'http://localhost:' + PORT,
		maxRequests: 1000,
		concurrency: 100,
		requestsPerSecond: 10,
		method: 'POST',
		payload: {
			hi: 'there',
		},
	};
	loadtest.loadTest(options, callback);
}

/**
 * Run an integration test.
 */
function integrationTest(callback)
{
	var server = testserver.startServer(PORT, function(error)
	{
		if (error)
		{
			return callback(error);
		}
		loadTest(function(error, result)
		{
			if (error)
			{
				return callback(error);
			}
			server.close(function(error)
			{
				if (error)
				{
					return callback(error);
				}
				callback(null, 'Server closed correctly');
			});
		});
	});
}

/**
 * Run all tests.
 */
exports.test = function(callback)
{
	testing.run({
		integration: integrationTest,
	}, 2000, callback);
}

// start load test if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

