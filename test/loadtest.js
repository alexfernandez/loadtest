import testing from 'testing'
import {loadTest} from '../lib/loadtest.js'


/**
 * A load test with max seconds.
 */
function testMaxSeconds(callback) {
	const options = {
		url: 'http://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
	};
	loadTest(options, callback);
}


/**
 * A load test with max seconds.
 */
function testWSEcho(callback) {
	const options = {
		url: 'ws://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
	};
	loadTest(options, callback);
}

function testIndexParam(callback) {
	const options = {
		url: 'http://localhost:7357/replace',
		concurrency:1,
		maxSeconds: 0.1,
		indexParam: "replace"
	};
	loadTest(options, callback);
}

function testIndexParamWithBody(callback) {
	const options = {
		url: 'http://localhost:7357/replace',
		concurrency:1,
		maxSeconds: 0.1,
		indexParam: "replace",
		body: '{"id": "replace"}'
	};
	loadTest(options, callback);
}

function testIndexParamWithCallback(callback) {
	const options = {
		url: 'http://localhost:7357/replace',
		concurrency:1,
		maxSeconds: 0.1,
		indexParam: "replace",
		indexParamCallback: function() {
			//https://gist.github.com/6174/6062387
			return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
		}
	};
	loadTest(options, callback);
}

function testIndexParamWithCallbackAndBody(callback) {
	const options = {
		url: 'http://localhost:7357/replace',
		concurrency:1,
		maxSeconds: 0.1,
		body: '{"id": "replace"}',
		indexParam: "replace",
		indexParamCallback: function() {
			//https://gist.github.com/6174/6062387
			return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
		}
	};
	loadTest(options, callback);
}


/**
 * Run all tests.
 */
export function test(callback) {
	testing.run([testMaxSeconds, testWSEcho, testIndexParam, testIndexParamWithBody, testIndexParamWithCallback, testIndexParamWithCallbackAndBody], callback);
}

