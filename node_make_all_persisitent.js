/**
 * Make All Routes Persistent App
 * ------------------------------
 * 
 * This app persists all routes added to a standard spacebrew server
 *
 *
 *
 * 
 */



// Import Modules and Configure Input and Output streams
var fs = require("fs")					// fs used for file read/write
	, WebSocketClient = require('ws') 	// websocket used for conection to spacebrew
	, stdin = process.openStdin()		// stdin used for user input
	, l = console.log 					// set 'l' as shorthand for log
	;

// Ready States for Spacebrew Connection - consistent with WebSocket.js
var CONNECTING = 0	
	, OPEN = 1
	, CLOSING = 2
	, CLOSED = 3
	;

// Application State Variables
var defaultPort = 9000
	, defaultHost = "localhost"
	, clients = []
	, routes = []
	, reconnect = undefined
	;

// Start-up And Run Live Persistent Router
printStartupMsg();
processArguments();
captureInput();
loadConfig(false); 		//auto-load config on startup
setupWSClient();


function printStartupMsg() {
	l("");
	l("This is a tool for persisting all routes created in the standard spacebrew admin.");
	l("Connecting to spacebrew server at " + defaultHost + ":" + defaultPort + ".");
	l("");
	l("Here are some useful commands:");
	l("  ls, add, remove, save, load, help, exit");
	l("");
	l("===========================================");
	l("");	
}


function processArguments (){
    var argv = process.argv;
    for(var i = 2; i < argv.length; i++){
        switch(argv[i]){
            case "--host":
                setSpacebrewHost(argv[++i]);
                break;
            case "-p":
            case "--port":
                setSpacebrewPort(argv[++i]);
                break;
            case "-h":
            case "--help":
                printCommandLineHelp();
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

/**
 * Register the function that processes each line of input from the user
 */
function captureInput() {
	// the stdin.on calls a function that accepts a command object that we can .toString 
	// to get the raw user input
	stdin.on('data', function(command){
	    runCommand(command.toString());
	});	
}


/**
 * Set the port of the spacebrew server. defaults to 9000. Can be overridden using the 
 * 		flag -p or --port when starting up the persistent router.
 * 		
 * @type {Number}
 */
function setSpacebrewPort(newPort){
    var tempPort = parseInt(newPort);
    //check that tempPort is a number and within valid port range
    if (!isNaN(tempPort) && tempPort >= 1 && tempPort <= 65535){
        defaultPort = tempPort;
    }
};

/**
 * Set the hostname of the device that hosts the spacebrew server. defaults to localhost. Can 
 * 		be overridden using the flag -h or --host when starting up the persistent router.
 * 		
 * @type {String}
 */
function setSpacebrewHost (newHost){
    defaultHost = newHost;
}


function printCommandLineHelp (){
    console.log("command line parameters:");
    console.log("\t--port (-p): set the port of the spacebrew server (default 9000)");
    console.log("\t--host: the hostname of the spacebrew server (default localhost)");
    console.log("\t--help (-h): print this help text");
    console.log("\t--log (-l): not yet implemented");
    console.log("\t--loglevel: not yet implemented");
    console.log("examples:");
    console.log("\tnode node_persistent_admin.js -p 9011");
    console.log("\tnode node_persistent_admin.js -h my-sweet-computer");
};


/**
 * Utility function for stripping out whitespaces
 * @param  {string} str The string input by stupid user
 * @return {string}     The string without leading or trailing whitespace
 */
function clean (str){
    return str.replace(/(^\s*|\s*$)/g,'');
};

/**
 * The function that takes a string input command, and does with it as appropriate.
 * 		This is used by both user input commands only.
 * 		
 * @param  {string} command the command to run
 */
function runCommand (command){
    //strip leading and trailing spaces
    command = clean(command.toString());

    if (command == "ls"){
        //list all publishers, then all subscribers, then all persistent routes
        var n = 0;
        l("publishers:");
        for(var i = 0; i < clients.length; i++){
            for (var j = 0; j < clients[i].publish.messages.length; j++){
                l("  "+(n++)+": "+clients[i].name+", "+clients[i].publish.messages[j].name);
            }
        }
        l("subscribers:");
        for(var i = 0; i < clients.length; i++){
            for (var j = 0; j < clients[i].subscribe.messages.length; j++){
                l("  "+(n++)+": "+clients[i].name+", "+clients[i].subscribe.messages[j].name);
            }
        }
        n = 0;
        l("routes:");
        for (var i = 0; i < routes.length; i++){
            var r = routes[i];
            l("  "+(n++)+": "+r.publisher.clientName+","+r.publisher.name+" -> "+r.subscriber.clientName+","+r.subscriber.name);
        }
    } 

    else if (command == "save"){
        fs.writeFile('./persistent_config.json', JSON.stringify(routes), function(err){
            if (err){
                l("there was an error while writing the config file");
                l(err);
            } else {
                l("config saved to persistent_config.json");
            }
        });
    } 

    else if (command == "load"){
        if (loadConfig(true)){
            l("successfully loaded");
            ensureConnected();
        }
    } 

    else if (command == "help"){
        printHelpText();
    } 

    else if (command == 'exit'){
        process.exit();
    } 

    else {
        l("unrecognized command, use \"help\" to see valid commands");
    }
};

var printHelpText = function(){
    l("This is a CLI admin for maintaining persistent routes in a spacebrew network.");
    l("commands:");
    l("  ls");
    l("    lists all clients, their publishers and subscribers, and the configured persistent routes");
    l("  save");
    l("    saves the current persistent route list to disk");
    l("  load");
    l("    overwrites the current persistent route list with the one on disk");
    l("    when the server starts up, it will automatically load an existing list from disk");
    l("  exit");
    l("    quits this persistent route admin (same as [ctrl]+c)");
};

function loadConfig (expectFile){
	var config;

	// open the config file
    try{
        config = fs.readFileSync("./persistent_config.json");
    } catch(err){
        if (expectFile) l("there was an error while reading the config file\n", err);
    }

    // parse the file contents
    try{
        routes = JSON.parse(config);
    }catch(err){
        l("there was an error while parsing the config file\n", err);
	    return false;
    }

	return true;
};


/**
 * Walks all the clients and all the persistent routes, and sends a route Add message for each
 * route that should exist.
 */
var ensureConnected = function(){
    //for each publisher, if that publisher is in the persistent routes
    //      for each subscriber, if that subscriber is the other end of that persistent route
    //          send the add route message

    //for each publisher
    for (var i = 0; i < clients.length; i++){
        for (var j = 0; j < clients[i].publish.messages.length; j++){
            // for each persistent route
            for (var k = 0; k < routes.length; k++){
                var currRoute = routes[k];

                // if the publisher is in a persistent route
                // ---- TO DO: check if the client remoteAddress also matches
                if (currRoute.publisher.clientName === clients[i].name &&
                	currRoute.publisher.remoteAddress === clients[i].remoteAddress &&
                    currRoute.publisher.name === clients[i].publish.messages[j].name){

                    // loop through all connected clients to find a subscriber
                    for (var m = 0; m < clients.length; m++){
                    	// loop through subscribers for each client
                        for (var n = 0; n < clients[m].subscribe.messages.length; n++){

			                // if a client/subscriber match is found then add route
			                // ---- TO DO: check if the client remoteAddress also matches
                            if (currRoute.subscriber.clientName === clients[m].name &&
                                currRoute.subscriber.remoteAddress === clients[m].remoteAddress &&
                                currRoute.subscriber.name === clients[m].subscribe.messages[n].name){

                                //if the pub/sub pair match the persistent route
                                //send route message
                                wsClient.send(JSON.stringify({
                                    route:{ 
                                    		type:'add'
                                        	, publisher: { 
                                        		clientName:clients[i].name
                                        		, name:clients[i].publish.messages[j].name
                                        		, type:clients[i].publish.messages[j].type
                                        		, remoteAddress:clients[i].remoteAddress
                                          	}
                                          	, subscriber:{
                                          		clientName:clients[m].name
                                          		, name:clients[m].subscribe.messages[n].name
                                          		, type:clients[m].subscribe.messages[n].type
                                          		, remoteAddress:clients[m].remoteAddress
											}
                                    }
                                }));
                            }
                        }
                    }
                }
            }
        }
    }
};

/**
 * Called when we receive a message from the Server.
 * @param  {websocket message} data The websocket message from the Server
 */
var receivedMessage = function(data, flags){
    console.log("[receivedMessage] received new message from spacebrew server ", data);

    if (data){
        var json = JSON.parse(data)
        	, status = handleMessage(json)
        	;

        if (status > 0){
            for(var i = 0, end = json.length; i < end; i++){
                handleMessage(json[i]);
            }
        } 

        else if (status < 0) {
        	console.log("message is not valid");
        }
    }
};

/**
 * Handle the json data from the Server and forward it to the appropriate function
 * @param  {json} json The message sent from the Server
 * @return {boolean}      True iff the message was a recognized type
 */
var handleMessage = function(json){
    if (json.message || json.admin){
        //do nothing
    } 

    else if (json.config){
		console.log("[handleMessage] add client request received ", json);
        handleConfigMessage(json);
    } 

    else if (json.route){
		console.log("[handleMessage] route request received ", json);
        if (json.route.type === 'remove'){
            handleRouteRemoveMessage(json);
        }
        if (json.route.type === 'add'){
            handleRouteAddMessage(json);
        }
    } 

    else if (json.remove){
        handleClientRemoveMessage(json);
    } 

    // return read array status
    else if (json instanceof Array) {
        return 1;
    }

    // return failure status
    else {
    	return -1;
    }

    // return success status
    return 0;
};

/**
 * Handles removes routes from the spacebrew server
 * @param {json} msg 	The route remove message from the Server
 */
var handleRouteRemoveMessage = function(msg){
	// if the route remove message was associated to client disconnecting, then don't
	// delete from the persistent route list.
	if ( msg.route.client_disconnect ) return;

	console.log("[handleRouteRemoveMessage] request received ", msg);
	console.log("[handleRouteRemoveMessage] pre - routes.length ", routes.length);

	for (var i = routes.length - 1; i >= 0; i--) {
		var currRoute = routes[i];
		if (currRoute.publisher.clientName === msg.route.publisher.clientName &&
			currRoute.publisher.name === msg.route.publisher.name &&
			currRoute.publisher.remoteAddress === msg.route.publisher.remoteAddress &&
			currRoute.subscriber.clientName == msg.route.subscriber.clientName &&
			currRoute.subscriber.name ===  msg.route.subscriber.name &&
			currRoute.subscriber.remoteAddress ===  msg.route.subscriber.remoteAddress){

			// remove this route
			routes.splice(i,1);
			console.log("[handleRouteRemoveMessage] removed route at index ", i);
		}
	};

	console.log("[handleRouteRemoveMessage] post - routes.length ", routes.length);

};

/**
 * Handles add routes from the spacebrew
 * @param {json} msg 	The route remove message from the Server
 */
var handleRouteAddMessage = function(msg){

	console.log("[handleRouteAddMessage] request received ", msg);

	//go through all persistent routes and see if this one exists already
	for (var i = routes.length - 1; i >= 0; i--) {
		var currRoute = routes[i];
		if (currRoute.publisher.clientName === msg.route.publisher.clientName &&
			currRoute.publisher.name === msg.route.publisher.name &&
			currRoute.publisher.remoteAddress === msg.route.publisher.remoteAddress &&
			currRoute.subscriber.clientName == msg.route.publisher.clientName &&
			currRoute.subscriber.name ===  msg.route.publisher.name &&
			currRoute.subscriber.remoteAddress ===  msg.route.publisher.remoteAddress){

			//this route already exists, abort
			return;
		}
	};

	//add the route to the list
	var newRoute = {
					publisher: msg.route.publisher,
					subscriber: msg.route.subscriber
				};

	console.log("[handleRouteAddMessage] new route ", newRoute);

	routes.push(newRoute);
}

/**
 * Utility function for helping determine if two config objects refer to the same Client
 * @param  {Client config} A 
 * @param  {Client config} B 
 * @return {boolean}   true iff the names and remote addresses match
 */
var areClientsEqual = function(A, B){
    return A.name === B.name && A.remoteAddress === B.remoteAddress; 
};

/**
 * Handles a remove message from the Server when a Client disconnects.
 * This function cleans up the appropriate data structures
 * @param  {json} msg The message from the Server
 */
var handleClientRemoveMessage = function(msg){
    for (var j = msg.remove.length-1; j >= 0; j--){
        for (var i = clients.length - 1; i >= 0; i--){
            if (areClientsEqual(clients[i], msg.remove[j])){
                clients.splice(i, 1);
                console.log("################### removed a client");
                break;
            }
        }
    }
};
   
/**
 * handles a new Config message from a Client. Will connect the new Client to 
 * all the necessary persistent routes.
 * @param  {json} msg The Config message from the Server from a Client
 */
var handleConfigMessage = function(msg){
    var existing = false;

    // see if we are updating a current client
    for (var i = clients.length-1; i >= 0; i--){
        if (areClientsEqual(clients[i], msg.config)){
            //we are updating an existing client
            console.log("################### updating a client");
            clients[i] = msg.config;
            existing = true;
        }
    }
    // otherwise add client to array
    if (!existing){
        console.log("################ adding a new client");
        clients.push(msg.config);
    }

	ensureConnected();
};

/**
 * Sends an 'add route' command to the Server.
 * @param {Client obj} pubClient The client of the publisher involved in the new route
 * @param {Pub obj} pub       The particular publisher exposed by pubClient involved in the new route
 * @param {Client obj} subClient The client of the subscriber involved in the new route
 * @param {Pub obj} sub       The particular subscriber exposed by subClient involved in the new route
 */
var addRoute = function(pubClient, pub, subClient, sub){
    if (pub.type != sub.type){
        return;
    }
    wsClient.send(JSON.stringify({
        route:{type:'add',
            publisher:{clientName:pubClient.name,
                        name:pub.name,
                        type:pub.type,
                        remoteAddress:pubClient.remoteAddress},
            subscriber:{clientName:subClient.name,
                        name:sub.name,
                        type:sub.type,
                        remoteAddress:subClient.remoteAddress}}
    }));
};

function setupWSClient(){ 
    // create the wsclient and register as an admin
    wsClient = new WebSocketClient("ws://"+defaultHost+":"+defaultPort);
    wsClient.on("open", function(conn){
        console.log("[ws.open] connected to spacebrew \n");
        var adminMsg = { "admin": [
            {"admin": true}
        ]};

        if (reconnect) {
        	reconnect = clearInterval(reconnect);
        }
        wsClient.send(JSON.stringify(adminMsg));
    });
    wsClient.on("message", receivedMessage);
    wsClient.on("error", function(){
    	console.log("Spacebrew Connection Error"); 
    	console.log(arguments);
		maintainConnection();
    });
    wsClient.on("close", function(){
		console.log("Spacebrew Connection Closed"); 
		console.log(arguments);
		maintainConnection();
    });
}

function maintainConnection() {
	if (!reconnect) {
		reconnect = setInterval(function() {
			if (wsClient.readyState !== OPEN) {
				wsClient.terminate();
	    		setupWSClient();	
			}
		}, 5000);    		
	}
}