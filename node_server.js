#!/usr/bin/env node

/**
 * Spacebrew Server
 * ----------------
 * 
 * This script runs the Spacebrew server, and optionally the spacebrew live
 * persistent router. In order to find out about the comand line flags just
 * run the script with '-h' or '--help' flag.
 *
 * @author: 	Quin Kennedy, Julio Terra, and other contributors
 * @filename: 	node_server.js
 * @date: 		May 31, 2013
 * @updated with version: 	0.3.0 
 *
 */

var spacebrew = require('./spacebrew')
	, persister = require('./spacebrew_live_persist')
	, logger = require('./logger')
	;

var defaultPort = 9000
	, forceClose = false
	, doPing = true
	, persist = true
	, help = false
	;

/**
 * Prints startup message to console/terminal
 */
var printStartupMsg = function() {
	console.log("");
	console.log("Running Spacebrew, start with argument '--help' to see available configuration arguments.");
	console.log("More info at http://www.spacebrew.cc");
	console.log("");
}

/**
 * Processes the command line arguments when app is launched
 */
var processArguments = function(){
    var argv = process.argv;
    for(var i = 0; i < argv.length; i++){
        switch(argv[i]){
            case "-l":
            case "--log":
            	setLogLevel("info");
            	break;
            case "--loglevel":
            	setLogLevel( argv[(i += 1)] );
            	break;
            case "-h":
            case "--help":
                printHelp();
                help = true;
                break;
            case "-p":
            case "--port":
                setDefaultPort(argv[++i]);
                break;
            case "-c":
            case "--close":
                forceClose = true;
                break;
            case "-t":
            case "--timeout":
                forceClose = true;
                setCloseTimeout(argv[++i]);
                break;
            case "--ping":
                doPing = true;
                break;
            case "--noping":
                doPing = false;
                break;
            case "--pinginterval":
                doPing = true;
                setPingIntervalTime(argv[++i]);
                break;
            case "--persist":
                persist = true;
                break;
            case "--nopersist":
                persist = false;
                break;
        }
    }
};

/**
 * Set the port to open for ws connections. defaults to 9000. 
 * 
 * @type {Number}
 */
var setDefaultPort = function(newPort){
    var tempPort = parseInt(newPort, 10);
    //check that tempPort != NaN
    //and that the port is in the valid port range
    if (tempPort == tempPort &&
        tempPort >= 1 && tempPort <= 65535){
        defaultPort = tempPort;
    }
	logger.log("info", "[setDefaultPort] port set to " + defaultPort);

};

var closeTimeout = 10000;//default to 10 seconds
var setCloseTimeout = function(newTimeout){
    var tempTimeout = parseInt(newTimeout);
    if (tempTimeout == tempTimeout && tempTimeout > 0){
        closeTimeout = tempTimeout;
    }
};

var pingIntervalTime = 1000;//every second
var setPingIntervalTime = function( newInterval ){
    var tempInterval = parseInt(newInterval);
    if (tempInterval == tempInterval && tempInterval > 0){
        pingIntervalTime = tempInterval;
    }
};

/**
 * method that is used to set the log level when user sets log level via command line
 * 
 * @param {String} newLevel 	New log level - "error", "warn", "debug", or "info"
 */
var setLogLevel = function( newLevel ) {
	logger.debugLevel = newLevel;
	logger.log("info", "[setLogLevel] log level set to " + logger.debugLevel);
}

/**
 * Prints the node server help message to screen
 */
var printHelp = function(){
    console.log("");
    console.log("command line parameters:");
    console.log("\t--port (-p): set the port of the spacebrew server (default 9000)");
    console.log("\t--help (-h): print this help text");
    console.log("\t--close (-c): force close clients that don't respond to pings");
    console.log("\t--timeout (-t): minimum number of ms to wait for response pong before force closing (implies --close, default 10000 [10 seconds])");
    console.log("\t--ping: enable pinging of clients to track who is potentially disconnected (default)");
    console.log("\t--noping: opposite of --ping");
    console.log("\t--persist: enables the live route persister, which saves route configurations");
    console.log("\t--nopersist: opposite of --persist");
    console.log("\t--pinginterval: the number of ms between pings (implies --ping, default 1000 [1 second])");
    console.log("\t--log (-l): sets logging to debug level");
    console.log("\t--loglevel: set logging to info, debug, warn, error or critical - not fully supported yet");
    console.log("examples:");
    console.log("\tnode node_server.js -p 9011 -t 1000 --pinginterval 1000");
    console.log("\tnode node_server.js --noping");
    console.log("");
};

/**
 * Method that handles key app functions including printing app startup message, processing
 * 		command line arguments, and starting up the spacebrew and persistent servers
 */
var main = function() {
	var server_configs = {}
		, persist_configs = {}
		;

	printStartupMsg();
	processArguments();

	// if app command included help flag then don't run app
	if (help) {
		process.exit();
	} 

	// if app command did not include help flag then start-up persist server
	else {
		server_configs = { 
			"port": defaultPort, 
			"forceClose": forceClose, 
			"ping": doPing, 
			"pingInterval": pingIntervalTime, 
			"closeTimeout": closeTimeout, 
			"logLevel": logger.debugLevel 
		}
		persist_configs = { 
			"host": "localhost", 
			"port": defaultPort, 
			"logLevel": logger.debugLevel 
		}
        
        // create spacebrew server
		spacebrew.createServer( server_configs );
		if (persist) persister.persistRoutes( persist_configs); 
	}
}

/**
 * Run the app
 */
main();
