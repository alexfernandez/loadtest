'use strict';

/**
 * API usage examples
 * (C) 2013 Alex Fernández.
 */


// requires
var loadtest = require('./loadtest.js');
var loadserver = require('./loadserver.js');
var Log = require('log');
var prototypes = require('./prototypes.js');

// globals
var log = new Log('info');

// constants
var PORT = 8000;


/**
 * Run an integration test.
 */
function integrationTest(callback)
{
	var server = loadserver.startServer(PORT, function(error)
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
			log.info('Server closed');
			callback();
		});
	});
}

/**
 * Run all tests.
 */
exports.test = function(callback)
{
	var run = false;
	integrationTest(function(error, result)
	{
		run = true;
		callback(error, result);
	});
	// give it time
	setTimeout(function()
	{
		if (!run)
		{
			callback('Sample run did not fire');
		}
	}, 100);
}

// start load test if invoked directly
if (__filename == process.argv[1])
{
	exports.test(function(error, result)
	{
		if (error)
		{
			return log.error('Tests failed: %s');
		}
		log.info('Tests passed');
	});
}

