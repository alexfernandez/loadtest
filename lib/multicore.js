#!/usr/bin/env node

import * as cluster from 'cluster'
import {cpus} from 'os'


export function getHalfCores() {
	const totalCores = cpus().length
	return Math.round(totalCores / 2) || 1
}

export async function runTask(cores, task) {
	if (cores == 1) {
		return await task()
	}
	if (cluster.isMaster) {
		for (let index = 0; index < cores; index++) {
			cluster.fork()
		}
	} else {
		await task()
	}
}


