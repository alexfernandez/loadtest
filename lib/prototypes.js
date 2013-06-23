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
 * Run package tests.
 */
exports.test = function()
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

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	exports.test();     
}

