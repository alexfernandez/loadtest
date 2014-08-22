#!/usr/bin/env node
'use strict';

/**
 * Binary to run test server.
 * (C) 2013 Manuel Ernst, Alex Fernández.
 */

// requires
var stdio = require('stdio');
var testServer = require('../lib/testserver');

// init
var options = stdio.getopt({
	delay: {key: 'd', args: 1, description: 'Delay the response for the given milliseconds'},
	error: {key: 'e', args: 1, description: 'Return an HTTP error code'},
	percent: {key: 'p', args: 1, description: 'Return an error (default 500) only for some % of requests'},
});
if (options.args && options.args.length == 1)
{
	options.port = parseInt(options.args[0], 10);
	if (!options.port)
	{
		console.error('Invalid port');
		options.printHelp();
		process.exit(1);
	}
}
if(options.delay)
{
    if(isNaN(options.delay))
	{
		console.error('Invalid delay');
		options.printHelp();
		process.exit(1);
    }
	options.delay = parseInt(options.delay, 10);
}

testServer.startServer(options);

