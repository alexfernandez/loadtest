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
		return [await task()]
	}
	if (cluster.isPrimary) {
		return await runWorkers(cores)
	} else {
		const result = await task()
		console.log('Worker finished')
		process.send(result)
	}
}

function runWorkers(cores) {
	return new Promise((resolve, reject) => {
		const results = []
		for (let index = 0; index < cores; index++) {
			const worker = cluster.fork()
			worker.on('message', message => {
				console.log('Received message', message)
				results.push(message)
				console.log(`Received ${results.length}, need ${cores}`)
				if (results.length === cores) {
					console.log('All messages received')
					return resolve(results)
				}
			})
		}
	})
}

