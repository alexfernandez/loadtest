import testing from 'testing'
import {Result} from '../lib/result.js'


function testCombineEmptyResults(callback) {
	const result = new Result()
	result.combine(new Result())
	testing.assert(!result.url, callback)
	testing.success(callback)
}

function testCombineResults(callback) {
	const combined = new Result()
	const url = 'https://pinchito.es/'
	for (let index = 0; index < 3; index++) {
		const result = {
			url,
			cores: 7,
			maxRequests: 1000,
			concurrency: 10,
			agent: 'none',
			requestsPerSecond: 100,
			totalRequests: 330,
			totalErrors: 10,
			startTimeMs: 1000 + index * 1000,
			stopTimeMs: 1000 + index * 2000,
			accumulatedMs: 5000,
			maxLatencyMs: 350 + index,
			minLatencyMs: 2 + index,
			errorCodes: {200: 100, 100: 200},
			histogramMs: {2: 1, 3: 4, 100: 300},
		}
		combined.combine(result)
	}
	testing.assertEquals(combined.url, url, callback)
	testing.assertEquals(combined.cores, 3, callback)
	testing.assertEquals(combined.totalErrors, 30, callback)
	testing.assertEquals(combined.elapsedSeconds, 4, callback)
	testing.success(callback)
}

export function test(callback) {
	const tests = [
		testCombineEmptyResults, testCombineResults,
	];
	testing.run(tests, callback);
}

