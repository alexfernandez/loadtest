import testing from 'testing'
import {Result} from '../lib/result.js'


function testCombineResults(callback) {
	const result = new Result()
	result.combine(new Result())
	testing.assert(!result.url, callback)
	testing.success(callback)
}

export function test(callback) {
	const tests = [
		testCombineResults,
	];
	testing.run(tests, callback);
}

