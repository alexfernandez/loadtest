'use strict';

/**
 * Package contains a load test script and a test server.
 * (C) 2013 Alex Fernández.
 */


// requires
var loadtest = require('./lib/loadtest.js');
var server = require('./lib/server.js');

// globals
var log = new Log('info');
var concurrency = 100;
var requestsPerSecond = 1;
var agent = true;

// exports
exports.loadTest = loadtest.loadTest;
exports.server = server.startServer;

