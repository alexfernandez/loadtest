/**
 * Run package tests.
 * (C) 2013 Alex Fernández.
 */

import testing from 'testing'
import {test as testHrtimer} from './hrtimer.js'
import {test as testHeaders} from './headers.js'
import {test as testLatency} from './latency.js'
import {test as testHttpClient} from './httpClient.js'
import {test as testServer} from './testserver.js'
import {test as testRequestGenerator} from './request-generator.js'
import {test as testLoadtest} from './loadtest.js'
import {test as testWebsocket} from './websocket.js'
import {test as integrationTest} from './integration.js'


/**
 * Run all module tests.
 */
function test() {
	const tests = [
		testHrtimer, testHeaders, testLatency, testHttpClient,
		testServer, testRequestGenerator, testLoadtest, testWebsocket,
		integrationTest,
	];
	testing.run(tests, 4200);
}

test()


