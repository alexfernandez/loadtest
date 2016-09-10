"use strict";

var urlLib = require('url');
var Log = require('log');
var headers = require('./headers.js');

// globals
var log = new Log('debug');


module.exports.BaseClient = function(operation, params)
{
	this.operation = operation;
	this.params = params;
	this.generateMessage = undefined;
};

/**
 * Get a function that finishes one request and goes for the next.
 */
module.exports.BaseClient.prototype.getRequestFinisher = function(id)
{
	var self = this;

	return function(error, result)
	{
		var errorCode = null;
		if (error)
		{
			log.debug('Connection %s failed: %s', id, error);
			if (result)
			{
				errorCode = result;
			}
			else
			{
				errorCode = '-1';
			}
		}
		else
		{
			log.debug('Connection %s ended', id);
		}
		self.operation.latency.end(id, errorCode);
		var callback;
		if (!self.params.requestsPerSecond)
		{
			callback = self.makeRequest;
		}
		self.operation.callback(error, result, callback);
	};
};


/**
 * Init options and message to send.
 */
module.exports.BaseClient.prototype.init = function()
{
	function identity(arg)
	{
		return function() { return arg; };
	}

	this.options = urlLib.parse(this.params.url);
	this.options.headers = {};
	if (this.params.headers)
	{
		this.options.headers = this.params.headers;
	}
	if (this.params.cert && this.params.key)
	{
		this.options.cert = this.params.cert;
		this.options.key = this.params.key;
	}
	this.options.agent = false;
	if (this.params.body)
	{
		if (typeof this.params.body == 'string')
		{
			log.debug('Received string body');
			this.generateMessage = identity(this.params.body);
		}
		else if (typeof this.params.body == 'object')
		{
			log.debug('Received JSON body');
			this.generateMessage = identity(this.params.body);
		}
		else if (typeof this.params.body == 'function')
		{
			log.debug('Received function body');
			this.generateMessage = this.params.body;
		}
		else
		{
			log.error('Unrecognized body: %s', typeof this.params.body);
		}
		this.options.headers['Content-Type'] = this.params.contentType || 'text/plain';
	}
	headers.addUserAgent(this.options.headers);
	if (this.params.secureProtocol) {
		this.options.secureProtocol = this.params.secureProtocol;
	}
	log.debug('Options: %j',this.options);
};

