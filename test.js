'use strict';

/**
 * Run package tests.
 * (C) 2013 Alex Fernández.
 */

// requires
const testing = require('testing');
const Log = require('log');

// globals
const log = new Log('info');


/**
 * Run all module tests.
 */
exports.test = function(callback)
{
	log.debug('Running tests');
	const tests = {};
	const libs = ['hrtimer', 'latency', 'integration', 'loadtest', 'headers', 'testserver', 'websocket', 'httpClient'];
	libs.forEach(function(lib)
	{
		tests[lib] = require('./lib/' + lib + '.js').test;
	});
	testing.run(tests, 4200, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test();
}

