'use strict';

/**
 * Prototypes for loadtest.
 * (C) 2013 Alex Fernández.
 */

// requires
var async = require('async');
var Log = require('log');

// globals
var log = new Log('info');

/**
 * Find out if the string has the parameter at the beginning.
 */
String.prototype.startsWith = function(str)
{
	return this.slice(0, str.length) == str;
};

/**
 * Find out if the string ends with the given parameter.
 */
String.prototype.endsWith = function(str)
{
	return this.slice(this.length - str.length) == str;
};

/**
 * Replace all occurrences of a string the replacement.
 */
String.prototype.replaceAll = function(find, replace)
{
	return this.split(find).join(replace);
}

/**
 * Run tests for string prototypes.
 */
function testStringPrototypes(callback)
{
	if (!'pepito'.startsWith('pe'))
	{
		return callback('Failed to match using startsWith()')
	}
	if ('pepito'.startsWith('po'))
	{
		return callback('Invalid match using startsWith()')
	}
	if (!'pepito'.endsWith('to'))
	{
		return callback('Failed to match using endsWith()')
	}
	if ('pepito'.startsWith('po'))
	{
		return callback('Invalid match using endsWith()')
	}
	if ('pepito'.replaceAll('p', 'c') != 'cecito')
	{
		return callback('Invalid replaceAll().');
	}
	callback(null, true);
}

/**
 * Count the number of properties in an object.
 */
exports.countProperties = function(object)
{
	var count = 0;
	for (var key in object)
	{
		count++;
	}
	return count;
}

/**
 * Overwrite the given object with the original.
 */
exports.overwriteObject = function(overwriter, original)
{
	if (!overwriter)
	{
		return original;
	}
	if (typeof(overwriter) != 'object')
	{
		log.error('Invalid overwriter object %s', overwriter);
		return original;
	}
	for (var key in overwriter)
	{
		var value = overwriter[key];
		if (value)
		{
			original[key] = value;
		}
	}
	return original;
}

/**
 * Test that overwrite object works.
 */
function testOverwriteObject(callback)
{
	var first = {
		a: 'a',
		b: 'b',
	};
	var second = {
		b: 'b2',
		c: {d: 5},
	};
	exports.overwriteObject(first, second);
	if (exports.countProperties(second) != 3)
	{
		return callback('Overwritten should have three properties');
	}
	if (second.b != 'b')
	{
		return callback('Property in second should be replaced with first');
	}
	callback(null, true);
}

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = {
		stringPrototypes: testStringPrototypes,
		overwrite: testOverwriteObject,
	};
	async.series(tests, callback);
}

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	exports.test(function(error, result)
	{
		if (error)
		{
			log.error('Tests failed: %s', error);
			return;
		}
		log.info('Tests succesful');
	});
}

