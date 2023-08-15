/**
 * Run package tests.
 * (C) 2013 Alex Fernández.
 */

import testing from 'testing'
import {test as testHrtimer} from './hrtimer.js'


/**
 * Run all module tests.
 */
function test() {
	const tests = [testHrtimer];
	testing.run(tests, 4200);
}

test()


