import testing from 'testing'
import {NetworkClient} from '../lib/networkClient.js'


function testHttpClient(callback) {
	const options = {
		url: 'http://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
	};
	new NetworkClient({options});
	testing.success(callback);
}


/**
 * Run all tests.
 */
export function test(callback) {
	testing.run([testHttpClient], callback)
}

