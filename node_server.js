var  spacebrew = require('./index');
var  persister = require('./spacebrew_live_persist');

var processArguments = function(){
    var argv = process.argv;
    for(var i = 2; i < argv.length; i++){
        switch(argv[i]){
            case "-p":
            case "--port":
                setDefaultPort(argv[++i]);
                break;
            case "-h":
            case "--help":
                printHelp();
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
            case "-l":
            case "--log":
                console.log('TODO: implement log flag');
                break;
            case "--loglevel":
                console.log("TODO: implement loglevel flag");
                break;
        }
    }
};

var defaultPort = 9000;
var forceClose = false;
var doPing = true;
var persist = true;

/**
 * Set the port to open for ws connections. defaults to 9000. 
 * Can be overridden using the flag -p or --port when starting up the server.
 * node node_server.js -p 9011
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
};

var closeTimeout = 10000;//default to 10 seconds
var setCloseTimeout = function(newTimeout){
    var tempTimeout = parseInt(newTimeout);
    if (tempTimeout == tempTimeout && tempTimeout > 0){
        closeTimeout = tempTimeout;
    }
};

var pingIntervalTime = 1000;//every second
var setPingIntervalTime = function(newInterval){
    var tempInterval = parseInt(newInterval);
    if (tempInterval == tempInterval && tempInterval > 0){
        pingIntervalTime = tempInterval;
    }
};

var printHelp = function(){
    console.log("command line parameters:");
    console.log("\t--port (-p): set the port of the spacebrew server (default 9000)");
    console.log("\t--help (-h): print this help text");
    console.log("\t--close (-c): force close clients that don't respond to pings");
    console.log("\t--timeout (-t): minimum number of ms to wait for response pong before force closing (implies --close, default 10000 [10 seconds])");
    console.log("\t--ping: enable pinging of clients to track who is potentially disconnected (default)");
    console.log("\t--noping: opposite of --ping");
    console.log("\t--persist: enables the live route persister, which saves route configurations");
    console.log("\t--noping: opposite of --persist");
    console.log("\t--pinginterval: the number of ms between pings (implies --ping, default 1000 [1 second])");
    console.log("\t--log (-l): not yet implemented");
    console.log("\t--loglevel: not yet implemented");
    console.log("examples:");
    console.log("\tnode node_server.js -p 9011 -t 1000 --pinginterval 1000");
    console.log("\tnode node_server.js --noping");
};

processArguments();

spacebrew.createServer({ port: defaultPort, forceClose: forceClose, ping:doPing, pingInterval: pingIntervalTime, closeTimeout: closeTimeout });

if (persist) { persister.persistRoutes({ host: "localhost" }); }

console.log("\nRunning Spacebrew, start with argument '--help' to see available configuration arguments.");
console.log("More info at http://www.spacebrew.cc");