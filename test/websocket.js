import testing from 'testing'
import {WebsocketClient} from '../lib/websocket.js'


function testWebsocketClient(callback) {
	const options = {
		url: 'ws://localhost:7358/',
		maxSeconds: 0.1,
		concurrency: 1,
	};
	new WebsocketClient({options});
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

