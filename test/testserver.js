import testing from 'testing'
import {startServer} from '../lib/testserver.js'


function testStartServer(callback) {
	const options = {
		port: 10530,
		quiet: true,
	};
	const server = startServer(options, error => {
		testing.check(error, 'Could not start server', callback);
		server.close(error => {
			testing.check(error, 'Could not stop server', callback);
			testing.success(callback);
		});
	});
}

/**
 * Run the tests.
 */
export function test(callback) {
	testing.run([testStartServer], 5000, callback);
}

