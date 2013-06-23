'use strict';

/**
 * Prototypes for loadtest.
 * (C) 2013 Alex Fernández.
 */

// requires
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
function testStringPrototypes()
{
	if (!'pepito'.startsWith('pe'))
	{
		log.error('Failed to match using startsWith()')
		return false;
	}
	if ('pepito'.startsWith('po'))
	{
		log.error('Invalid match using startsWith()')
		return false;
	}
	if (!'pepito'.endsWith('to'))
	{
		log.error('Failed to match using endsWith()')
		return false;
	}
	if ('pepito'.startsWith('po'))
	{
		log.error('Invalid match using endsWith()')
		return false;
	}
	if ('pepito'.replaceAll('p', 'c') != 'cecito')
	{
		log.error('Invalid replaceAll().');
		return false;
	}
	return true;
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
function testOverwriteObject()
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
		log.error('Overwritten should have three properties');
		return false;
	}
	if (second.b != 'b')
	{
		log.error('Property in second should be replaced with first');
		return false;
	}
	return true;
}

/**
 * Run package tests.
 */
exports.test = function()
{
	if (!testStringPrototypes)
	{
		return false;
	}
	if (!testOverwriteObject)
	{
		return false;
	}
	return true;
}

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	exports.test();     
}

