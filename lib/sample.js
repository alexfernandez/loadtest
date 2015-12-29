'use strict';

/**
 * API usage examples
 * (C) 2013 Alex Fernández.
 */


// requires
require('prototypes');
var loadtest = require('./loadtest.js');
var testserver = require('./testserver.js');
var testing = require('testing');
var Log = require('log');

// globals
var log = new Log('debug');

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
			maxRequests: 100,
			concurrency: 10,
			method: 'POST',
			body: {
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
				return callback(null, 'Test results: ' + JSON.stringify(result));
			});
		});
	});
}



/**
 * Run an integration test.
 */
function testWSIntegration(callback)
{
	var server = testserver.startServer({ port: PORT }, function(error)
	{
		if (error)
		{
			return callback(error);
		}
		var options = {
			url: 'ws://localhost:' + PORT,
			maxRequests: 10,
			concurrency: 10,
			body: {
/*				var update = {
					requestId: Math.floor(Math.random() * 0x100000000).toString(16),
					type: 'ping',
				};*/
				type: 'ping',
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
				return callback(null, 'Test results: ' + JSON.stringify(result));
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
			maxRequests: 10,
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
exports.test = function(callback)
{
	log.debug('Running all tests');
	testing.run([testIntegration, testDelay, testWSIntegration], 4000, callback);
};

// start load test if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

