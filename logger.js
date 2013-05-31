/**
 * Logger Module
 * -------------
 * 
 * This module provides simple logging functionality used in most spacebrew scripts.
 * Developed based on an example from Josh Holbrook on the nodejitsu site.
 *
 * @author: 	Julio Terra
 * @filename: 	logger.js
 * @date: 		May 31, 2013
 * @updated with version: 	0.3.0 
 *
 */
var logger = exports;

logger.debugLevel = 'debug';

logger.log = function(level, message) {
	var levels = ['error', 'warn', 'debug', 'info'];
	if (levels.indexOf(level) <= levels.indexOf(logger.debugLevel) ) {
		if (typeof message !== 'string') {
			message = JSON.stringify(message);
		};
		console.log(level+': '+message);
	}
}