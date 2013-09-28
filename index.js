'use strict';

/**
 * Package contains a load test script and a test server.
 * (C) 2013 Alex Fernández.
 */


// requires
var loadtest = require('./lib/loadtest.js');
var testserver = require('./lib/testserver.js');

// exports
exports.loadTest = loadtest.loadTest;
exports.startServer = testserver.startServer;

