import testing from 'testing'
import {loadTest} from '../lib/loadtest.js'


function testMaxSeconds(callback) {
	const options = {
		url: 'http://localhost:7358/',
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
	};
	loadTest(options, callback);
}

function testWSEcho(callback) {
	const options = {
		url: 'ws://localhost:7358/',
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
	};
	loadTest(options, callback);
}

function testIndexParam(callback) {
	const options = {
		url: 'http://localhost:7358/replace',
		concurrency:1,
		maxSeconds: 0.1,
		indexParam: "replace",
		quiet: true,
	};
	loadTest(options, callback);
}

function testIndexParamWithBody(callback) {
	const options = {
		url: 'http://localhost:7358/replace',
		concurrency:1,
		maxSeconds: 0.1,
		indexParam: "replace",
		body: '{"id": "replace"}',
		quiet: true,
	};
	loadTest(options, callback);
}

function testIndexParamWithCallback(callback) {
	const options = {
		url: 'http://localhost:7358/replace',
		concurrency:1,
		maxSeconds: 0.1,
		indexParam: "replace",
		indexParamCallback: function() {
			//https://gist.github.com/6174/6062387
			return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
		},
		quiet: true,
	};
	loadTest(options, callback);
}

function testIndexParamWithCallbackAndBody(callback) {
	const options = {
		url: 'http://localhost:7358/replace',
		concurrency:1,
		maxSeconds: 0.1,
		body: '{"id": "replace"}',
		indexParam: "replace",
		indexParamCallback: function() {
			//https://gist.github.com/6174/6062387
			return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
		},
		quiet: true,
	};
	loadTest(options, callback);
}

function testError(callback) {
	const options = {
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
	};
	loadTest(options, (error) => {
		if (!error) {
			return callback('Should error without URL')
		}
		return callback(false, 'OK')
	});
}

/**
 * A load test with keep-alive.
 */
function testKeepAlive(callback) {
	const options = {
		url: 'http://localhost:7358/',
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
		keepalive: true,
	};
	loadTest(options, callback)
}


/**
 * Run all tests.
 */
export function test(callback) {
	testing.run([
		testMaxSeconds, testWSEcho, testIndexParam, testIndexParamWithBody,
		testIndexParamWithCallback, testIndexParamWithCallbackAndBody,
		testError, testKeepAlive,
	], callback);
}

