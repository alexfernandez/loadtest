import testing from 'testing'
import {addHeaders, addUserAgent} from '../lib/headers.js'


function testAddHeaders(callback) {
	const tests = [{
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
	}, {
		raw: {accept: 'text/plain;text/html'},
		headers: {accept: 'text/plain;text/html'},
	}];
	tests.forEach(function(test) {
		const headers = {};
		addHeaders(test.raw, headers);
		testing.assertEquals(headers, test.headers, 'Wrong headers', callback);
	});
	testing.success(callback);
}

function testAddUserAgent(callback) {
	const headers =  {'k': 'v', 'q': 'r' };
	addUserAgent(headers);
	testing.assertEquals(Object.keys(headers).length, 3, 'Did not add user agent', callback);
	const userAgent = headers['user-agent'];
	testing.assert(userAgent.includes('bot'), 'Invalid user agent', callback);
	addUserAgent(headers);
	testing.assertEquals(Object.keys(headers).length, 3, 'Should not add user agent', callback);
	testing.success(callback);
}

/**
 * Run all tests.
 */
export function test(callback) {
	testing.run([
		testAddHeaders,
		testAddUserAgent,
	], callback);
}

