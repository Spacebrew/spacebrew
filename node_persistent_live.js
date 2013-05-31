/**
 * Spacebrew Live Persist Server
 * -----------------------------
 * 
 * This script runs the Spacebrew Live Persist module as a standalone server.
 * It can be used to add live persist functionality to any spacebrew server,
 * local or remote.
 *
 * @author: 	Julio Terra
 * @filename: 	node_persistent_live.js
 * @date: 		May 31, 2013
 * @updated with version: 	0.3.0 
 *
 */


var logger = require('./logger')
	, livePersister = require('./spacebrew_live_persist')
	, port = 9000
	, host = "localhost"
	, help = false
	;

/**
 * Prints startup message to console/terminal
 */
var printStartupMsg = function() {
	console.log("");
	console.log("This is a tool for persisting all routes created in the standard spacebrew admin.");
	console.log("Connecting to spacebrew server at " + host + ":" + port + ".");
	console.log("");
	console.log("===========================================");
	console.log("");	
}

/**
 * Processes the command line arguments when app is launched
 */
var processArguments = function(){
    var argv = process.argv;
    for(var i = 2; i < argv.length; i++){
        switch(argv[i]){
            case "-console.log":
            case "--log":
            	setLogLevel("info");
            	break;
            case "--loglevel":
            	setLogLevel( argv[i++] );
            	break;
            case "--host":
                setSpacebrewHost(argv[++i]);
                break;
            case "-p":
            case "--port":
                setSpacebrewPort(argv[++i]);
                break;
            case "-h":
            case "--help":
                printHelp();
                help = true;
                break;
        }
    }
};

/**
 * Set the port of the spacebrew server. defaults to 9000. Can be overridden using the 
 * 		flag -p or --port when starting up the persistent router.
 * 		
 * @type {Number}
 */
var setSpacebrewPort = function( newPort ){
    newPort = parseInt( newPort );
    //check that tempPort is a number and within valid port range
    if (!isNaN( newPort ) && newPort >= 1 && newPort <= 65535){
        port = tempPort;
		logger.log("info", "[setSpacebrewHost] set spacebrew port to " + newPort);
    }
};

/**
 * Set the hostname of the device that hosts the spacebrew server. defaults to localhost. Can 
 * 		be overridden using the flag -h or --host when starting up the persistent router.
 * 		
 * @type {String}
 */
var setSpacebrewHost = function ( newHost ){
    host = newHost;
	logger.log("info", "[setSpacebrewHost] set spacebrew host to " + newHost);
}

/**
 * method that is used to set the log level when user sets log level via command line
 * 
 * @param {String} newLevel 	New log level - "error", "warn", "debug", or "info"
 */
var setLogLevel = function( newLevel ) {
	logger.debugLevel = newLevel;
	logger.log("info", "[setLogLevel] log level set to " + newLevel);
}

/**
 * Prints the node server help message to screen
 */
var printHelp = function (){
	console.log("command line parameters:");
	console.log("\t--port (-p): set the port of the spacebrew server (default 9000)");
	console.log("\t--host: the hostname of the spacebrew server (default localhost)");
	console.log("\t--help (-h): print this help text");
	console.log("examples:");
	console.log("\tnode spacebrew_live_persist.js -p 9011");
	console.log("\tnode spacebrew_live_persist.js -h my-sweet-computer");
	console.log("");
};

/**
 * Method that handles key app functions including printing app startup message, processing
 * 		command line arguments, and starting up persistent server
 */
var main = function() {
	var persist_configs = {};

	printStartupMsg();
	processArguments();

	// if app command included help flag then don't run app
	if (help) {
		process.exit();
	} 

	// if app command did not include help flag then start-up persist server
	else {
		persist_configs = {
			"host": host, 
			"port": port, 
			"logLevel": logger.debugLevel 
		}
		livePersister.persistRoutes( persist_configs );
	}
}

/**
 * Run the app
 */
main();