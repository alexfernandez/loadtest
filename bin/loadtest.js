#!/usr/bin/env node

import {readFile} from 'fs/promises'
import * as stdio from 'stdio'
import {loadTest} from '../lib/loadtest.js'
import {showResult} from '../lib/show.js'


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
	index: {args: 1, description: 'Replace the value of given arg with an index in the URL'},
	insecure: {description: 'Allow self-signed certificates over https'},
	key: {args: 1, description: 'The client key to use'},
	cert: {args: 1, description: 'The client certificate to use'},
	agent: {description: 'Use a keep-alive http agent (deprecated)'},
	quiet: {description: 'Do not log any messages (deprecated)'},
	debug: {description: 'Show debug messages (deprecated)'}
});

async function processAndRun(options) {
	if (options.version) {
		const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
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
	try {
		const result = await loadTest(options)
		showResult(options, result)
	} catch(error) {
		console.error(error.message)
		help()
	}
}

await processAndRun(options)

/**
 * Show online help.
 */
function help() {
	options.printHelp();
	process.exit(1);
}
