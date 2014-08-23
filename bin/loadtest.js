#!/usr/bin/env node
'use strict';

/**
 * Binary to run loadtest.
 * (C) 2013 Manuel Ernst, Alex Fernández.
 */

// requires
var stdio = require('stdio');
var fs = require('fs');
var path = require('path');
var urlLib = require('url');
var loadTest = require('../lib/loadtest.js');
var headers = require('../lib/headers.js');
var packageJson = require(__dirname + '/../package.json');

// init
var options = stdio.getopt({
	maxRequests: {key: 'n', args: 1, description: 'Number of requests to perform'},
	concurrency: {key: 'c', args: 1, description: 'Number of requests to make'},
	maxSeconds: {key: 't', args: 1, description: 'Max time in seconds to wait for responses'},
	contentType: {key: 'T', args: 1, description: 'MIME type for the body'},
	cookies: {key: 'C', multiple: true, description: 'Send a cookie as name=value'},
	headers: {key: 'H', multiple: true, description: 'Send a header as header:value'},
	postBody: {key: 'P', args: 1, description: 'Send string as POST body'},
	postFile: {key: 'p', args: 1, description: 'Send the contents of the file as POST body'},
	putFile: {key: 'u', args: 1, description: 'Send the contents of the file as PUT body'},
	recover: {key: 'r', description: 'Do not exit on socket receive errors (default)'},
	keepalive: {key: 'k', description: 'Use a keep-alive http agent'},
	version: {key: 'V', description: 'Show version number and exit'},
	rps: {args: 1, description: 'Specify the requests per second for each client'},
	agent: {description: 'Use a keep-alive http agent (deprecated)'},
	index: {args: 1, description: 'Replace the value of given arg with an index in the URL'},
	quiet: {description: 'Do not log any messages'},
	debug: {description: 'Show debug messages'},
	insecure: {description: 'Allow self-signed certificates over https'},
});
if (options.version)
{
	console.log('Loadtest version: %s', packageJson.version);
	process.exit(0);
}
// is there an url? if not, break and display help
if (!options.args || options.args.length < 1)
{
	console.error('Missing URL to load-test');
	options.printHelp();
	process.exit(1);
}
else if (options.args.length > 1)
{
	console.error('Too many arguments: %s', options.args);
	options.printHelp();
	process.exit(1);
}
options.url = options.args[0];
options.agentKeepAlive = options.keepalive || options.agent;
options.indexParam = options.index;

//TODO: add index Param
// Allow a post body string in options
// Ex -P '{"foo": "bar"}'
if (options.postBody)
{
	options.method = 'POST';
	options.body = options.postBody;
}
if(options.postFile)
{
	options.method = 'POST';
	options.body = readBody(options.postFile, '-p');
}
if(options.putFile)
{
	options.method = 'PUT';
	options.body = readBody(options.putFile, '-u');
}
if(options.rps)
{
	options.requestsPerSecond = parseFloat(options.rps);
}
var defaultHeaders =
{
	host: urlLib.parse(options.url).host,
	'user-agent': 'loadtest/' + packageJson.version,
	accept: '*/*'
};

if (options.headers)
{
	headers.addHeaders(options.headers, defaultHeaders);
	console.log('headers: %s, %j', typeof defaultHeaders, defaultHeaders);
}

options.headers = defaultHeaders;
loadTest.loadTest(options);

function readBody(filename, option)
{
	if (typeof filename !== 'string')
	{
		console.error('Invalid file to open with %s: %s', option, filename);
		help();
	}

	if(path.extname(filename) === '.js')
	{
		return require(path.resolve(filename));
	}

	return fs.readFileSync(filename, {encoding: 'utf8'});
}

/**
 * Show online help.
 */
function help(options)
{
	options.printHelp();
	process.exit(1);
}
