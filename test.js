'use strict';

/**
 * Run package tests.
 * (C) 2013 Alex Fernández.
 */

// requires
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
	var tests = {};
	var libs = [ 'prototypes', 'timing', 'sample', 'websocket' ];
	libs.forEach(function(lib)
	{
		tests[lib] = require('./lib/' + lib + '.js').test;
	});
	testing.run(tests, 2200, callback);
}

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

