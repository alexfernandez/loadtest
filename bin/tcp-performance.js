import {loadTest, startServer} from '../index.js'

const port = 7359;
const serverOptions = {port}


async function runTcpPerformanceTest() {
	const server = await startServer(serverOptions)
	const options = {
		url: `http://localhost:${port}`,
		method: 'GET',
		tcp: true,
	};
	const result = await loadTest(options)
	await server.close()
	console.log(`Requests received: ${server.totalRequests}`)
	result.show()
}

await runTcpPerformanceTest()

