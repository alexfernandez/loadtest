'use strict';

/**
 * Package contains a load test script and a test server.
 * (C) 2013 Alex Fernández.
 */


// requires
const loadtest = require('./lib/loadtest.js');
const testserver = require('./lib/testserver.js');

// exports
exports.loadTest = loadtest.loadTest;
exports.startServer = testserver.startServer;

