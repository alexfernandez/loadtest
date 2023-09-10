import testing from 'testing'
import {HttpClient} from '../lib/httpClient.js'


function testHttpClient(callback) {
	const options = {
		url: 'http://localhost:7358/',
		maxSeconds: 0.1,
		concurrency: 1,
	};
	new HttpClient({options});
	testing.success(callback);
}


/**
 * Run all tests.
 */
export function test(callback) {
	testing.run([testHttpClient], callback)
}

