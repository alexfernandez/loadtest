import testing from 'testing'
import {create} from '../lib/httpClient.js'


function testHttpClient(callback) {
	const options = {
		url: 'http://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
	};
	create({}, options);
	testing.success(callback);
}


/**
 * Run all tests.
 */
export function test(callback) {
	testing.run([testHttpClient], callback)
}

