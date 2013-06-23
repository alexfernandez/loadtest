'use strict';

/**
 * Run package tests.
 * (C) 2013 Alex Fernández.
 */

// requires
var prototypes = require('./lib/prototypes.js');
var timing = require('./lib/timing.js');
var sample = require('./lib/sample.js');
var util = require('util');
var async = require('async');
var Log = require('log');

// globals
var log = new Log('info');


/**
 * Run all module tests.
 */
exports.test = function(callback)
{
	var run = false;
	var tests = {
		prototypes: prototypes.test,
		timing: timing.test,
		sample: sample.test,
	};
	async.series(tests, function(error, result)
	{
		run = true;
		callback(error, result);
	});
	// give it time
	setTimeout(function()
	{
		if (!run)
		{
			callback('Package tests did not call back');
		}
	}, 2200);
}

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(function(error, result)
	{
		if (error)
		{
			log.error('Failure in tests: %s', error);
			process.exit(1);
			return;
		}
		log.info('All tests successful: %s', util.inspect(result, true, 10, true));
	});
}

