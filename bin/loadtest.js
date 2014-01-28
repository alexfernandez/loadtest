#!/usr/bin/env node
'use strict';

/**
 * Binary to run loadtest.
 * (C) 2013 Manuel Ernst, Alex Fernández.
 */

// requires
var args = require('optimist').argv;
var fs = require('fs');
var loadTest = require('../lib/loadtest.js');

// globals
var options = {};

// init
// is there an url? if not, break and display help
if(args._.length === 0)
{
	help();
}
options.url = args._[0];
assignArgument('n', args, 'maxRequests', options);
assignArgument('c', args, 'concurrency', options);
assignArgument('t', args, 'maxSeconds', options);
assignArgument('C', args, 'cookies', options);
assignArgument('H', args, 'rawHeaders', options);
assignArgument('T', args, 'contentType', options);
assignArgument('r', args, 'recover', options, true);
assignArgument('agent', args, 'agent', options, false);
assignArgument('keepalive', args, 'agentKeepAlive', options, true);
assignArgument('quite', args, 'quiet', options, true);
assignArgument('debug', args, 'debug', options, true);
//TODO: add index Param
if(args.p)
{
	options.method = 'POST';
	options.body = fs.readFileSync(args.p);
}
if(args.u)
{
	options.method = 'PUT';
	options.body = fs.readFileSync(args.u);
}
if(args.rps)
{
	options.requestsPerSecond = parseFloat(args.rps);
}
if (options.rawHeaders)
{
	options.headers = {};
	readHeaders(options.rawHeaders, options.headers);
	console.log('headers: %s, %j', typeof options.headers, options.headers);
}
loadTest.loadTest(options);

function assignArgument(shortName, source, name, options, overwrite)
{
	if(source[shortName])
	{
		options[name] = overwrite !== undefined ? overwrite : source[shortName];
	}
}

function readHeaders(rawHeaders, headers)
{
	if (typeof rawHeaders == 'string')
	{
		if (!rawHeaders.contains(':'))
		{
			console.error('Invalid header %s, it should be in the form -H key:value');
			help();
		}
		var pieces = rawHeaders.split(':');
		var key = pieces[0];
		var value = pieces[1];
		if (key in headers)
		{
			var previous = headers[key];
			if (!Array.isArray(previous))
			{
				previous = [previous];
				headers[key] = previous;
			}
			previous.push(value);
		}
		else
		{
			headers[key] = pieces[1];
		}
		return;
	}
	if (!Array.isArray(rawHeaders))
	{
		console.error('Invalid header structure %j, it should be an array');
		return;
	}
	rawHeaders.forEach(function(header)
	{
		readHeaders(header, headers);
	});
}

/**
 * Show online help.
 */
function help()
{
	console.log('Usage: loadtest [options] URL');
	console.log('  where URL can be a regular HTTP or websocket URL:');
	console.log('  runs a load test for the given URL');
	console.log('Apache ab-compatible options are:');
	console.log('    -n requests     Number of requests to perform');
	console.log('    -c concurrency  Number of multiple requests to make');
	console.log('    -t timelimit    Seconds to max. wait for responses');
	console.log('    -T content-type The MIME type for the body');
	console.log('    -C name=value   Send a cookie with the given name');
	console.log('    -H header:value Send a header with the given value');
	console.log('    -p POST-file    Send the contents of the file as POST body');
	console.log('    -u PUT-file     Send the contents of the file as PUT body');
	console.log('    -r              Do not exit on socket receive errors');
	console.log('Other options are:');
	console.log('    --rps           Requests per second for each client');
	console.log('    --noagent       Do not use http agent (default)');
	console.log('    --agent         Use http agent (Connection: keep-alive)');
	console.log('    --keepalive     Use a specialized keep-alive http agent (agentkeepalive)');
	console.log('    --index param   Replace the value of param with an index in the URL');
	console.log('    --quiet         Do not log any messages');
	console.log('    --debug         Show debug messages');
	process.exit(1);
}
