var testServer = require('../lib/testserver');

var args = require('optimist').argv;

if(args.help || args.h) {
    console.log('Usage: testserver [options] [port]');
    console.log('  starts a test server on the given port, default 80.');
    console.log('Options are:');
    console.log('    --delay           Delay the response for the given milliseconds');

    process.exit(0);
}

var options = {};

if(args._.length > 0) {
    if(!isNaN(args._[0])) {
        options.port = parseInt(args._[0], 10);
    } else {
        console.log('port has to be a number');
        process.exit(1);
    }
}

if(args.delay) {
    if(!isNaN(args.delay)) {
        options.delay = parseInt(args.delay);
    } else {
        console.log('delay has to be a number');
        process.exit(1);
    }
}

testServer.startServer(args);