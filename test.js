'use strict';

/**
 * Run package tests.
 * (C) 2013 Alex Fernández.
 */

// requires
var prototypes = require('./lib/prototypes.js');
var timing = require('./lib/timing.js');
var Log = require('log');

// globals
var log = new Log('info');


/**
 * Run all module tests.
 */
exports.test = function()
{
	if (!prototypes.test())
	{
		log.error('Failure in prototypes test');
		exit(1);
	}
	if (!timing.test())
	{
		log.error('Failure in timing test');
		exit(1);
	}
	log.notice('Tests run correctly');
}

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test();
}

