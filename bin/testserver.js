#!/usr/bin/env node

import * as stdio from 'stdio'
import {startServer} from '../lib/testserver.js'
import {loadConfig} from '../lib/config.js'
import {getHalfCores, runTask} from '../lib/cluster.js'

const configuration = loadConfig()
const options = readOptions()
start(options)


function readOptions() {
	const options = stdio.getopt({
		port: {key: 'p', args: 1, description: 'Port for the server'},
		delay: {key: 'd', args: 1, description: 'Delay the response for the given milliseconds'},
		error: {key: 'e', args: 1, description: 'Return an HTTP error code'},
		percent: {key: 'P', args: 1, description: 'Return an error (default 500) only for some % of requests'},
		cores: {key: 'c', args: 1, description: 'Number of cores to use, default is half the total', default: getHalfCores()},
		body: {key: 'b', args: 1, description: 'Body to return, default "OK"'},
		file: {key: 'f', args: 1, description: 'File to read and return as body'},
	});
	if (options.args && options.args.length == 1) {
		options.port = options.port || options.args[0]
	}
	return {
		port: readInt(options, 'port'),
		delay: readInt(options, 'delay'),
		error: readInt(options, 'error'),
		percent: readInt(options, 'percent'),
		cores: readInt(options, 'cores'),
		body: readString(options, 'body'),
		file: readString(options, 'file'),
	}
}

function readString(options, key) {
	return options[key] || configuration[key]
}

function readInt(options, key) {
	if (options[key] && isNaN(options[key])) {
		console.error(`Invalid ${key}`);
		options.printHelp();
		process.exit(1);
	}
	const value = readString(options, key)
	return parseInt(value) || undefined
}

function start(options) {
	runTask(options.cores, async () => {await startServer(options)})
}


