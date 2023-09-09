import testing from 'testing'
import {Latency} from '../lib/latency.js'


const mockLoadTest = {running: true, checkStop: () => false, countClients: () => 0}

/**
 * Test latency ids.
 */
function testLatencyIds(callback) {
	const latency = new Latency(mockLoadTest);
	const firstId = latency.begin();
	testing.assert(firstId, 'Invalid first latency id %s', firstId, callback);
	const secondId = latency.begin();
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
	const latency = new Latency({options, ...mockLoadTest})
	for (let i = 0; i < 9; i++) {
		const id = latency.begin();
		latency.end(id);
	}
	const id = latency.begin();
	latency.end(id, errorCode);
	testing.assert(latency.shouldStop(), 'Should stop now', callback);
	latency.stop()
	const result = latency.getResult()
	testing.assertEquals(result.totalRequests, 10, 'Invalid total requests', callback);
	testing.assertEquals(result.totalErrors, 1, 'Invalid total errors', callback);
	testing.assert(errorCode in result.errorCodes, 'Error code not found', callback);
	testing.assertEquals(result.errorCodes[errorCode], 1, 'Should have one ' + errorCode, callback);
	testing.success(callback);
}

/**
 * Check that percentiles are correct.
 */
function testLatencyPercentiles(callback) {
	const options = {
		maxRequests: 10
	};
	const latency = new Latency({options, ...mockLoadTest})
	for (let ms = 1; ms <= 10; ms++) {
		(function() {
			const id = latency.begin();
			setTimeout(() => {
				latency.end(id);
			}, ms);
		})();
	}
	setTimeout(() => {
		testing.assert(latency.shouldStop(), 'Should stop now', callback);
		latency.stop()
		const percentiles = latency.getResult().percentiles;

		Object.keys(percentiles).forEach(percentile => {
			testing.assert(percentiles[percentile] !== false, 'Empty percentile for %s', percentile, callback);
		});

		testing.success(percentiles, callback);
	}, 20)
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

