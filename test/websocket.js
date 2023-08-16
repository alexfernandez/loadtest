import testing from 'testing'
import {create} from '../lib/websocket.js'


function testWebsocketClient(callback) {
	const options = {
		url: 'ws://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
	};
	create({}, options);
	testing.success(callback);
}

/**
 * Run tests, currently nothing.
 */
export function test(callback) {
	testing.run([
		testWebsocketClient,
	], callback);
}

