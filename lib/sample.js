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
 * Run an integration test.
 */
function testIntegration(callback)
{
	var server = testserver.startServer({ port: PORT }, function(error)
	{
		if (error)
		{
			return callback(error);
		}
		var options = {
			url: 'http://localhost:' + PORT,
			maxRequests: 1000,
			concurrency: 100,
			method: 'POST',
			payload: {
				hi: 'there',
			},
		};
		loadtest.loadTest(options, function(error, result)
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
				callback(null, result);
			});
		});
	});
}

/**
 * Run a delayed test.
 */
function testDelay(callback)
{
	var delay = 10;
	var options = {
		port: PORT + 1,
		delay: delay,
	};
	var server = testserver.startServer(options, function(error)
	{
		if (error)
		{
			return callback(error);
		}
		options = {
			url: 'http://localhost:' + (PORT + 1),
			maxRequests: 100,
		};
		loadtest.loadTest(options, function(error, result)
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
				testing.assertEquals(result.totalRequests, 100, 'Invalid total requests', callback);
				testing.assert(result.meanLatencyMs >= delay, 'Delay should be higher than %s, not %s', delay, result.meanLatencyMs, callback);
				callback(null, result);
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
		integration: testIntegration,
		delay: testDelay,
	}, 4000, callback);
}

// start load test if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

