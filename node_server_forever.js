#!/usr/bin/env node

/**
 * Spacebrew Server with Forever
 * ------------------------------
 * 
 * This script runs the Spacebrew server, and optionally the spacebrew live
 * persistent router, in forever mode. This means that the server is automatically
 * relaunched if it crashes. All standard node_server.js options are supported. 
 * To find out about the comand line flags just run the script with the '-h' or 
 * '--help' flag. 
 *
 * Latest Updates:
 * - checks if data/log folder already exists, and if not, it creates folder
 *
 * @author: 	Quin Kennedy, Julio Terra, and other contributors
 * @filename: 	node_server.js
 * @date: 		June 1st, 2013
 * @updated with version: 	0.3.1 
 *
 */


var	forever = require('forever-monitor')
	, fs = require('fs')
	, logger = require('./logger')
	, argv = process.argv.splice(2, process.argv.length)
	, restarts = 0
	, date = Date.parse(new Date)
	, help = false
	, data_dir = __dirname + "/data"
	, log_dir = __dirname + "/data/log"
	;


/**
 * check if data/log directory already exists, and if not, then create it.
 */ 
var setupLogDirectory = function() {
	// check if data folder exists
	try {
		fs.statSync(data_dir);
	} 
	catch (e) {
		fs.mkdir(data_dir);	
		logger.log("info", "creating data directory");
	}

	// check if data/log folder exists
	try {
		fs.statSync(log_dir);
	} 
	catch (e) {
		fs.mkdir(__dirname + "/data/log");	
		logger.log("info", "creating data/log directory");
	}	
}

/**
 * Parses CLI arguments to confirm if there are any commands that need to occur before 
 * the app is launched in forever mode
 */
var processArguments = function(){
	for(var i = 0; i < argv.length; i++){
        switch(argv[i]){
            case "-l":
            case "--log":
            	logger.debugLevel = "info";
            	break;
            case "--loglevel":
            	logger.debugLevel = argv[(i += 1)];
            	break;            case "-x":
            case "--cleanstart":
            	try {
					fs.unlinkSync('./data/routes/live/live_persist_config.json');
            	}
            	catch (e) {
            		logger.log('warn', "[processArguments] not able to delete /data/routes/live/live_persist_config.json")
            	}
            	break;
            case "-h":
            case "--help":
            	help = true;
            	break;
        }
	}	
}


var createForeverServer = function() {

	/**
	 * Forever server configurations for launching the spacebrew server in forever mode
	 * @type {forever.Monitor}
	 */
	var server = new (forever.Monitor)('node_server.js', {
		'silent': false
		, 'options': argv
		, 'uid': 'spacebrew'
		, 'pid': './data/'
		, 'logFile': './data/log/spacebrew_forever_' + date + '.log'
	   	, 'outFile': './data/log/spacebrew_info_' + date + '.log'
		, 'errFile': './data/log/spacebrew_error_' + date + '.log'
	});

	/**
	 * Register event handler for application exit events
	 * @return {[type]} [description]
	 */
	server.on('exit', function () {
		logger.log('info','[Exit] the spacebrew server will no longer be restarted');
	});

	/**
	 * Register event handler for spacebrew server restart events, due to app crashing
	 */
	server.on('restart', function () {
		restarts += 1;
		date = Date.parse(new Date);

		// if script was run with help flag then stop after first restart
		if (help) {
			process.exit();
		}

		// otherwise, print restart count message
		else {
			logger.log('warn','[Restart] the spacebrew server has been restarted ' + restarts + ' time');
		}
	});

	server.start();
}

setupLogDirectory();
processArguments();
createForeverServer();

