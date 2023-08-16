import {loadTest} from './lib/loadtest.js'
import {startServer} from './lib/testserver.js'

const loadtest = {loadTest, startServer}

export default loadtest

export * from './lib/loadtest.js'
export * from './lib/testserver.js'

