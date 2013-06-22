'use strict';

/**
 * Prototypes for loadtest.
 * (C) 2013 Alex Fernández.
 */


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

