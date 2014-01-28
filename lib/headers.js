'use strict';

/**
 * Support for custom headers.
 * (C) 2013 Alex Fernández.
 */

// requires
require('prototypes');
var testing = require('testing');


/**
 * Read all headers and return in a suitable array.
 */
exports.readHeaders = function(rawHeaders)
{
	var headers = [];
	if (Array.isArray(rawHeaders))
	{
		rawHeaders.forEach(function(header)
		{
			addHeader(header, headers);
		});
	}
	else if (typeof rawHeaders == 'string')
	{
		addHeader(rawHeaders, headers);
	}
	else
	{
		console.error('Invalid header structure %j, it should be an array');
	}
	return headers;
};

function addHeader(rawHeader, headers)
{
	if (!rawHeader.contains(':'))
	{
		return console.error('Invalid header %s, it should be in the form -H key:value');
	}
	var pieces = rawHeader.split(':');
	var key = pieces[0];
	var value = pieces[1];
	headers.push([key, value]);
}

/**
 * Test some headers.
 */
function testHeaders(callback)
{
	var tests = [
		{
			raw: 'k:v',
			headers: [['k', 'v']],
		},
		{
			raw: ['k:v', 'k:v2'],
			headers: [['k', 'v'], ['k', 'v2']],
		},
		{
			raw: ['k:v', 'k2:v2'],
			headers: [['k', 'v'], ['k2', 'v2']],
		}
	];
	tests.forEach(function(test)
	{
		var result = exports.readHeaders(test.raw);
		testing.assertEquals(result, test.headers, 'Wrong headers', callback);
	});
	testing.success(callback);
}

/**
 * Run all tests.
 */
exports.test = function(callback)
{
	testing.run([testHeaders], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

