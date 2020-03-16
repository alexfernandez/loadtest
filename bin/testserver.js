#!/usr/bin/env node
'use strict';

/**
 * Binary to run test server.
 * (C) 2013 Manuel Ernst, Alex Fernández.
 */

// requires
const stdio = require('stdio');
const testServer = require('../lib/testserver');
const config = require('../lib/config')

// init
const options = stdio.getopt({
	delay: {key: 'd', args: 1, description: 'Delay the response for the given milliseconds'},
	error: {key: 'e', args: 1, description: 'Return an HTTP error code'},
	percent: {key: 'p', args: 1, description: 'Return an error (default 500) only for some % of requests'},
});
const configuration = config.loadConfig(options)
if (options.args && options.args.length == 1) {
	options.port = parseInt(options.args[0], 10);
	if (!options.port) {
		console.error('Invalid port');
		options.printHelp();
		process.exit(1);
	}
}
if(options.delay) {
	if(isNaN(options.delay)) {
		console.error('Invalid delay');
		options.printHelp();
		process.exit(1);
	}
	options.delay = parseInt(options.delay, 10);
}

if(!options.delay) {
	options.delay = configuration.delay
}
if(!options.error) {
	options.error = configuration.error
}
if(!options.percent) {
	options.percent = configuration.percent
}

testServer.startServer(options);

