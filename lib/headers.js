'use strict';

/**
 * Support for custom headers.
 * (C) 2013 Alex Fernández.
 */

// requires
const testing = require('testing');


/**
 * Add all raw headers given to the given array.
 */
exports.addHeaders = function(rawHeaders, headers) {
	if (Array.isArray(rawHeaders)) {
		rawHeaders.forEach(function(header) {
			addHeader(header, headers);
		});
	} else if (typeof rawHeaders == 'string') {
		addHeader(rawHeaders, headers);
	} else {
		console.error('Invalid header structure %j, it should be an array');
	}
};

/**
 * Add a single header to an array.
 */
function addHeader(rawHeader, headers) {
	if (!rawHeader.includes(':')) {
		return console.error('Invalid header %s, it should be in the form -H key:value');
	}
	const index = rawHeader.indexOf(':');
	const key = rawHeader.substr(0, index);
	const value = rawHeader.substr(index + 1);
	headers[key.toLowerCase()] = value;
}

function testAddHeaders(callback) {
	const tests = [ {
		raw: 'k:v',
		headers: { 'k': 'v' }
	}, {
		raw: ['k:v', 'k:v2'],
		headers:  { 'k': 'v2' }
	}, {
		raw: ['k:v', 'k2:v2'],
		headers: { 'k': 'v', 'k2': 'v2' }
	}, {
		raw: 'K:v',
		headers: { 'k': 'v' }
	}, {
		raw: 'k:v:w',
		headers: { 'k': 'v:w' }
	}
	];
	tests.forEach(function(test) {
		const headers = {};
		exports.addHeaders(test.raw, headers);
		testing.assertEquals(headers, test.headers, 'Wrong headers', callback);
	});
	testing.success(callback);
}

/**
 * Add a user-agent header if not present.
 */
exports.addUserAgent = function(headers) {
	if(!headers['user-agent']) {
		headers['user-agent'] = 'node.js loadtest bot';
	}
};

function testAddUserAgent(callback) {
	const headers =  {'k': 'v', 'q': 'r' };
	exports.addUserAgent(headers);
	testing.assertEquals(Object.keys(headers).length, 3, 'Did not add user agent', callback);
	const userAgent = headers['user-agent'];
	testing.assert(userAgent.includes('bot'), 'Invalid user agent', callback);
	exports.addUserAgent(headers);
	testing.assertEquals(Object.keys(headers).length, 3, 'Should not add user agent', callback);
	testing.success(callback);
}

/**
 * Run all tests.
 */
exports.test = function(callback) {
	testing.run([
		testAddHeaders,
		testAddUserAgent,
	], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1]) {
	exports.test(testing.show);
}

