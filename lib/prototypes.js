'use strict';

/**
 * Prototypes for loadtest.
 * (C) 2013 Alex Fernández.
 */

// requires
var testing = require('testing');
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
	testing.assert('pepito'.startsWith('pe'), 'Failed to match using startsWith()', callback);
	testing.assert(!'pepito'.startsWith('po'), 'Invalid match using startsWith()', callback);
	testing.assert('pepito'.endsWith('to'), 'Failed to match using endsWith()', callback);
	testing.assert(!'pepito'.startsWith('po'), 'Invalid match using endsWith()', callback);
	testing.assertEquals('cecito', 'pepito'.replaceAll('p', 'c'), 'Invalid replaceAll().', callback);
	testing.success(callback);
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
	testing.assertEquals(3, exports.countProperties(second), 'Overwritten should have three properties', callback);
	testing.assertEquals('b', second.b, 'Property in second should be replaced with first', callback);
	testing.success(callback);
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
	testing.run(tests, callback);
}

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	exports.test(testing.show);
}

