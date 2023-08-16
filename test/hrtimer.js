/**
 * Measure latency for a load test.
 * (C) 2013 Alex Fernández.
 */


import testing from 'testing';
import {HighResolutionTimer} from '../lib/hrtimer.js'


/**
 * Test a high resolution timer.
 */
function testTimerStop(callback) {
	const timer = new HighResolutionTimer(10, callback);
	setImmediate(() => timer.stop())
}

function testTimerRun(callback) {
	let run = 0
	const timer = new HighResolutionTimer(100, () => run++)
	setTimeout(() => {
		testing.equals(run, 3, callback)
		timer.stop()
		testing.success(callback)
	}, 250)
}

/**
 * Run package tests.
 */
export function test(callback) {
	const tests = [
		testTimerStop,
		testTimerRun,
	];
	testing.run(tests, callback);
}

