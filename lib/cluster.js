process.env.NODE_CLUSTER_SCHED_POLICY = 'none'

import {cpus} from 'os'
// dynamic import as workaround: https://github.com/nodejs/node/issues/49240
const cluster = await import('cluster')


export function getHalfCores() {
	const totalCores = cpus().length
	return Math.round(totalCores / 2) || 1
}

export async function runTask(cores, task) {
	if (cores == 1) {
		return await task()
	}
	if (cluster.isPrimary) {
		for (let index = 0; index < cores; index++) {
			cluster.fork()
		}
	} else {
		await task()
	}
}

