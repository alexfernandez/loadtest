#!/usr/bin/env node

/**
 * Console wrapper.
 * Adapted from supervisor: https://github.com/isaacs/node-supervisor/
 * (C) 2013 Alex Fernández.
 */

var path = require('path');
var fs = require('fs');
var prototypes = require('./prototypes');

var args = process.argv.slice(1);

var arg = args.shift();
var realpath = fs.realpathSync(arg);
var name = path.basename(arg).substringUpTo('.');
var lib = require('./' + name + '.js');
if (!lib)
{
	console.error('Could not find %s', name);
	return;
}
lib.run(args);

