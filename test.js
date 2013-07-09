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
var testing = require('testing');
var Log = require('log');

// globals
var log = new Log('info');


/**
 * Run all module tests.
 */
exports.test = function(callback)
{
	var tests = {
		prototypes: prototypes.test,
		timing: timing.test,
		sample: sample.test,
	};
	testing.run(tests, 2200, callback);
}

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

