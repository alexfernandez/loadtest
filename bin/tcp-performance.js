import {loadTest, startServer} from '../index.js'
const cluster = await import('cluster')
import {getHalfCores} from '../lib/cluster.js'

const port = 7360;
const serverOptions = {port}

if (cluster.isPrimary) {
	await runTcpPerformanceTest()
} else {
	await runServer()
}

async function runTcpPerformanceTest() {
	const workers = await startWorkers()
	const options = {
		url: `http://localhost:${port}`,
		method: 'GET',
		tcp: true,
		concurrency: 10,
	};
	const result = await loadTest(options)
	result.show()
	console.log(`Test finished; closing server on ${workers.length} cores`)
	await stopServer(workers)
}

function startWorkers() {
	return new Promise(resolve => {
		// do not use more than three cores for the server
		const cores = Math.min(3, getHalfCores())
		const workers = []
		for (let i = 0; i < cores; i++) {
			const worker = cluster.fork()
			worker.on('message', async () => {
				workers.push(worker)
				if (workers.length != cores) {
					return
				}
				console.log(`Server started on ${workers.length} cores`)
				return resolve(workers)
			})
		}
	})
}

function stopServer(workers) {
	for (const worker of workers) {
		worker.kill('SIGTERM')
	}
}

async function runServer() {
	await startServer(serverOptions)
	process.send('server ready')
}

