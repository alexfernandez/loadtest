#!/usr/bin/env node

import {readFile} from 'fs/promises'
import * as stdio from 'stdio'
import {loadTest} from '../lib/loadtest.js'
import {runTask} from '../lib/cluster.js'
import {Result} from '../lib/result.js'
import {getHalfCores} from '../lib/cluster.js'


const options = stdio.getopt({
	maxSeconds: {key: 't', args: 1, description: 'Max time in seconds to wait for responses, default 10'},
	maxRequests: {key: 'n', args: 1, description: 'Number of requests to perform'},
	concurrency: {key: 'c', args: 1, description: 'Number of concurrent requests, default 10'},
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
	quiet: {description: 'Do not log any messages'},
	cores: {args: 1, description: 'Number of cores to use', default: getHalfCores()},
	tcp: {description: 'Use TCP sockets (experimental)'},
	agent: {description: 'Use a keep-alive http agent (deprecated)'},
	debug: {description: 'Show debug messages (deprecated)'},
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
	options.cores = parseInt(options.cores) || 1
	const results = await runTask(options.cores, async workerId => await startTest(options, workerId))
	if (!results) {
		process.exit(0)
		return
	}
	showResults(results)
}

function showResults(results) {
	if (results.length == 1) {
		results[0].show()
		return
	}
	const combined = new Result()
	for (const result of results) {
		combined.combine(result)
	}
	combined.show()
}

async function startTest(options, workerId) {
	if (!workerId) {
		// standalone; controlled errors
		try {
			return await loadTest(options)
		} catch(error) {
			console.error(error.message)
			return help()
		}
	}
	shareWorker(options, workerId)
	return await loadTest(options)
}

function shareWorker(options, workerId) {
	options.maxRequests = shareOption(options.maxRequests, workerId, options.cores)
	options.rps = shareOption(options.rps, workerId, options.cores)
}

function shareOption(option, workerId, cores) {
	if (!option) return null
	const total = parseInt(option)
	const shared = Math.round(total / cores)
	if (workerId == cores) {
		// last worker gets remainder
		return total - shared * (cores - 1)
	} else {
		return shared
	}
}

await processAndRun(options)

function help() {
	options.printHelp();
	process.exit(1);
}

