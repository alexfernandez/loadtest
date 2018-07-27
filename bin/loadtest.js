#!/usr/bin/env node
'use strict';

/**
 * Binary to run loadtest.
 * (C) 2013 Manuel Ernst, Alex Fernández.
 */

// requires
const stdio = require('stdio');
const fs = require('fs');
const path = require('path');
const urlLib = require('url');
const loadTest = require('../lib/loadtest.js');
const headers = require('../lib/headers.js');
const packageJson = require(__dirname + '/../package.json');

// init
const options = stdio.getopt({
	maxRequests: {key: 'n', args: 1, description: 'Number of requests to perform'},
	concurrency: {key: 'c', args: 1, description: 'Number of requests to make'},
	maxSeconds: {key: 't', args: 1, description: 'Max time in seconds to wait for responses'},
	timeout: {key: 'd', args: 1, description: 'Timeout for each request in milliseconds'},
	contentType: {key: 'T', args: 1, description: 'MIME type for the body'},
	cookies: {key: 'C', multiple: true, description: 'Send a cookie as name=value'},
	headers: {key: 'H', multiple: true, description: 'Send a header as header:value'},
	postBody: {key: 'P', args: 1, description: 'Send string as POST body'},
	postFile: {key: 'p', args: 1, description: 'Send the contents of the file as POST body'},
	patchBody: {key: 'A', args: 1, description: 'Send string as PATCH body'},
	patchFile: {key: 'a', args: 1, description: 'Send the contents of the file as PATCH body'},
	data: {args: 1, description: 'Send data POST body'},
	method: {key: 'm', args: 1, description: 'method to url'},
	putFile: {key: 'u', args: 1, description: 'Send the contents of the file as PUT body'},
	requestGenerator: {key: 'R', args: 1, description: 'JS module with a custom request generator function'},
	recover: {key: 'r', description: 'Do not exit on socket receive errors (default)'},
	secureProtocol: {key: 's', args: 1, description: 'TLS/SSL secure protocol method to use'},
	keepalive: {key: 'k', description: 'Use a keep-alive http agent'},
	version: {key: 'V', description: 'Show version number and exit'},
	proxy: {args: 1, description: 'Use a proxy for requests e.g. http://localhost:8080 '},	
	rps: {args: 1, description: 'Specify the requests per second for each client'},
	agent: {description: 'Use a keep-alive http agent (deprecated)'},
	index: {args: 1, description: 'Replace the value of given arg with an index in the URL'},
	quiet: {description: 'Do not log any messages'},
	debug: {description: 'Show debug messages'},
	insecure: {description: 'Allow self-signed certificates over https'},
	key: {args: 1, description: 'The client key to use'},
	cert: {args: 1, description: 'The client certificate to use'}
});
if (options.version) {
	console.log('Loadtest version: %s', packageJson.version);
	process.exit(0);
}
// is there an url? if not, break and display help
if (!options.args || options.args.length < 1) {
	console.error('Missing URL to load-test');
	help();
} else if (options.args.length > 1) {
	console.error('Too many arguments: %s', options.args);
	help();
}
options.url = options.args[0];
options.agentKeepAlive = options.keepalive || options.agent;
options.indexParam = options.index;

//TODO: add index Param
// Allow a post body string in options
// Ex -P '{"foo": "bar"}'
if (options.postBody) {
	options.method = 'POST';
	options.body = options.postBody;
}
if (options.postFile) {
	options.method = 'POST';
	options.body = readBody(options.postFile, '-p');
}
if (options.data) {
	options.body = JSON.parse(options.data);
}
if (options.method) {
	const acceptedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'get', 'post', 'put', 'delete', 'patch'];
	if (acceptedMethods.indexOf(options.method) === -1) {
		options.method = 'GET';
	}
}
if(options.putFile) {
	options.method = 'PUT';
	options.body = readBody(options.putFile, '-u');
}
if (options.patchBody) {
	options.method = 'PATCH';
	options.body = options.patchBody;
}
if(options.patchFile) {
	options.method = 'PATCH';
	options.body = readBody(options.patchFile, '-a');
}
if(options.rps) {
	options.requestsPerSecond = parseFloat(options.rps);
}
if(options.key) {
	options.key = fs.readFileSync(options.key);
}
if(options.cert) {
	options.cert = fs.readFileSync(options.cert);
}
const defaultHeaders = {
	host: urlLib.parse(options.url).host,
	'user-agent': 'loadtest/' + packageJson.version,
	accept: '*/*'
};

if (options.headers) {
	headers.addHeaders(options.headers, defaultHeaders);
	console.log('headers: %s, %j', typeof defaultHeaders, defaultHeaders);
}

if (options.requestGenerator) {
	options.requestGenerator = require(path.resolve(options.requestGenerator));
}

options.headers = defaultHeaders;
loadTest.loadTest(options);

function readBody(filename, option) {
	if (typeof filename !== 'string') {
		console.error('Invalid file to open with %s: %s', option, filename);
		help();
	}

	if(path.extname(filename) === '.js') {
		return require(path.resolve(filename));
	}

	const ret = fs.readFileSync(filename, {encoding: 'utf8'}).replace("\n", "");

	return ret;
}

/**
 * Show online help.
 */
function help() {
	options.printHelp();
	process.exit(1);
}
