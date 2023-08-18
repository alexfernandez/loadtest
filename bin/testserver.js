#!/usr/bin/env node

import * as stdio from 'stdio'
import {startServer} from '../lib/testserver.js'
import {loadConfig} from '../lib/config.js'
import * as cluster from 'cluster'
import {cpus} from 'os'
import {getHalfCores, runTask} from '../lib/multicore.js'

const options = readOptions()
start(options)


function readOptions() {
	const options = stdio.getopt({
		delay: {key: 'd', args: 1, description: 'Delay the response for the given milliseconds'},
		error: {key: 'e', args: 1, description: 'Return an HTTP error code'},
		percent: {key: 'p', args: 1, description: 'Return an error (default 500) only for some % of requests'},
		cores: {key: 'c', args: 1, description: 'Number of cores to use, default is half the total', default: getHalfCores()}
	});
	const configuration = loadConfig()
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
	return options
}

function start(options) {
	runTask(options.cores, () => startServer(options))
}


