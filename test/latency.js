import testing from 'testing'
import {Latency} from '../lib/latency.js'


/**
 * Test latency ids.
 */
function testLatencyIds(callback) {
	const latency = new Latency({});
	const firstId = latency.start();
	testing.assert(firstId, 'Invalid first latency id %s', firstId, callback);
	const secondId = latency.start();
	testing.assert(secondId, 'Invalid second latency id', callback);
	testing.assert(firstId != secondId, 'Repeated latency ids', callback);
	testing.success(callback);
}

/**
 * Test latency measurements.
 */
function testLatencyRequests(callback) {
	const options = {
		maxRequests: 10,
	};
	const errorCode = '500';
	const latency = new Latency(options, (error, result) => {
		testing.check(error, 'Could not compute latency', callback);
		testing.assertEquals(result.totalRequests, 10, 'Invalid total requests', callback);
		testing.assertEquals(result.totalErrors, 1, 'Invalid total errors', callback);
		testing.assert(errorCode in result.errorCodes, 'Error code not found', callback);
		testing.assertEquals(result.errorCodes[errorCode], 1, 'Should have one ' + errorCode, callback);
		testing.success(callback);
	});
	let id;
	for (let i = 0; i < 9; i++) {
		id = latency.start();
		latency.end(id);
	}
	id = latency.start();
	latency.end(id, errorCode);
}

/**
 * Check that percentiles are correct.
 */
function testLatencyPercentiles(callback) {
	const options = {
		maxRequests: 10
	};
	const latency = new Latency(options, error => {
		testing.check(error, 'Error while testing latency percentiles', callback);
		const percentiles = latency.getResult().percentiles;

		Object.keys(percentiles).forEach(percentile => {
			testing.assert(percentiles[percentile] !== false, 'Empty percentile for %s', percentile, callback);
		});

		testing.success(percentiles, callback);
	});
	for (let ms = 1; ms <= 10; ms++) {
		(function() {
			const id = latency.start();
			setTimeout(() => {
				latency.end(id);
			}, ms);
		})();
	}
}

/**
 * Run package tests.
 */
export function test(callback) {
	const tests = [
		testLatencyIds,
		testLatencyRequests,
		testLatencyPercentiles,
	];
	testing.run(tests, callback);
}

