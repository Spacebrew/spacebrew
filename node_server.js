var  spacebrew = require('./index');
/**
 * The port to open for ws connections. defaults to 9000. 
 * Can be overridden by a first argument when starting up the server.
 * node node_server.js 9011
 * @type {Number}
 */
var spacePort = 9000;
if (process.argv[2]) {
    var tempPort = parseInt(process.argv[2], 10);
    //check that tempPort != NaN
    //and that the port is in the valid port range
    if (tempPort == tempPort &&
        tempPort >= 1 && tempPort <= 65535){
        spacePort = tempPort;
    }
}

spacebrew.createServer({ port: spacePort });

console.log("\nRunning Spacebrew on PORT "+spacePort);
console.log("More info at http://www.spacebrew.cc");