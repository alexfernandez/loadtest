'use strict';

/**
 * Support for custom headers.
 * (C) 2013 Alex Fernández.
 */

// requires
require('prototypes');
var testing = require('testing');


/**
 * Add all raw headers given to the given array.
 */
exports.addHeaders = function(rawHeaders, headers)
{
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
};

/**
 * Add a single header to an array.
 */
function addHeader(rawHeader, headers)
{
	if (!rawHeader.contains(':'))
	{
		return console.error('Invalid header %s, it should be in the form -H key:value');
	}
	var index = rawHeader.indexOf(':');
	var key = rawHeader.substr(0, index);
	var value = rawHeader.substr(index + 1);
	headers.push([key.toLowerCase(), value]);
}

function testAddHeaders(callback)
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
		},
		{
			raw: 'K:v',
			headers: [['k', 'v']],
		},
		{
			raw: 'k:v:w',
			headers: [['k', 'v:w']]
		}
	];
	tests.forEach(function(test)
	{
		var headers = [];
		exports.addHeaders(test.raw, headers);
		testing.assertEquals(headers, test.headers, 'Wrong headers', callback);
	});
	testing.success(callback);
}

/**
 * Convert a map of headers to an array.
 */
exports.convert = function(original)
{
	if (Array.isArray(original))
	{
		return original.slice(0);
	}
	var headers = [];
	for (var key in original)
	{
		headers.push([key, original[key]]);
	}
	return headers;
};

/**
 * Check the conversion from map of headers to array.
 */
function testConvert(callback)
{
	var tests = [
		{
			original: [['k', 'v']],
			headers: [['k', 'v']],
		},
		{
			original: {k: 'v', k2: 'v2'},
			headers: [['k', 'v'], ['k2', 'v2']],
		},
	];
	tests.forEach(function(test)
	{
		var result = exports.convert(test.original);
		testing.assertEquals(result, test.headers, 'Wrong headers', callback);
	});
	testing.success(callback);
}

/**
 * Add a user-agent header if not present.
 */
exports.addUserAgent = function(headers)
{
	for (var key in headers)
	{
		var header = headers[key];
		if (header[0] == 'user-agent')
		{
			return;
		}
	}
	headers.push(['user-agent', 'node.js loadtest bot']);
};

function testAddUserAgent(callback)
{
	var headers = [
		['k', 'v'],
		['q', 'r'],
	];
	exports.addUserAgent(headers);
	testing.assertEquals(headers.length, 3, 'Did not add user agent', callback);
	var userAgent = headers[2][1];
	testing.assert(userAgent.contains('bot'), 'Invalid user agent', callback);
	exports.addUserAgent(headers);
	testing.assertEquals(headers.length, 3, 'Should not add user agent', callback);
	testing.success(callback);
}

/**
 * Run all tests.
 */
exports.test = function(callback)
{
	testing.run([
		testAddHeaders,
		testConvert,
		testAddUserAgent,
	], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

