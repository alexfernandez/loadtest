#!/usr/bin/env node

/**
 * Console wrapper.
 * Adapted from supervisor: https://github.com/isaacs/node-supervisor/
 * (C) 2013 Alex Fernández.
 */

var path = require("path");
var fs = require("fs");

var args = process.argv;
console.log('Arg: %s', args[0], args[1]);

/*
var arg, base;
do arg = args.shift();
while ( fs.realpathSync(arg) !== __filename
  && (base = path.basename(arg)) !== "node-supervisor"
  && base !== "supervisor"
  && base !== "supervisor.js"
)

require("./supervisor").run(args)
*/

