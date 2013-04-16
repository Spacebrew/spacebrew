/**
 * Spacebrew Live Persist
 * ------------------------------
 * 
 * This app persists all routes added to a standard spacebrew server
 *
 *
 *
 * 
 */

// Import Modules 
var fs = require("fs")					// fs used for file read/write
	, WebSocketClient = require('ws') 	// websocket used for conection to spacebrew
	, stdin = process.openStdin()		// stdin used for user input
	, l = console.log 				// set 'l' as shorthand for log
	;

// Ready States for Spacebrew Connection - consistent with WebSocket.js
var CONNECTING = 0	
	, OPEN = 1
	, CLOSING = 2
	, CLOSED = 3
	;

exports.persistRoutes = function( opts ){

	// Import Modules and Configure Input and Output streams
	var reconnect = undefined			// holds timer that maintains server connection
		;

	var port = opts.port || 9000
		, host = opts.host || "localhost"
		, autosave = opts.autosave || true
		, load = opts.load || true
		, load_file = opts.load_file || "live_persist_config.json"
		;

	var clients = []
		, routes = []
		;

	var setupWSClient = function(){ 

		// create the wsclient to connect to spacebrew
		wsc = new WebSocketClient("ws://" + host + ":" + port);

		// configure the spacebrew admin client once connection stablished
		wsc.on("open", function(conn){
			console.log("[ws.open] connected to spacebrew \n");

			// send the admin configuration message to spacebrew server
			var adminMsg = { "admin": [ 
					{ 
						"admin": true
						, "no_msgs" : true
					} 
				]};
			wsc.send(JSON.stringify(adminMsg));


			// if the reconnect timer is activated then stop it
			if (reconnect) {
				reconnect = clearInterval(reconnect);
				reconnect = undefined;
			}

			// load the routes that were saved
			if (load) loadRoutes(load_file);
		});

		// handle messages
		wsc.on("message", receivedMessage);

		// handle websocket error events
		wsc.on("error", function(){
			console.log("[ws.onerror] spacebrew Connection Error"); 
			console.log(arguments);
			if (wsc.readyState != OPEN) reestablishConnection();
		});

		// handle websocket close events
		wsc.on("close", function(){
			console.log("[on.close] spacebrew Connection Closed"); 
			console.log(arguments);
			reestablishConnection();
		});
	}

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
	                                wsc.send(JSON.stringify({
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

	    saveRoutes();

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
		routes.push(newRoute);

	    saveRoutes();

		console.log("[handleRouteAddMessage] new route ", newRoute);
	}

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
	    wsc.send(JSON.stringify({
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

	var saveRoutes = function() {
		fs.writeFile('./data/live_persist_config.json', JSON.stringify(routes), function(err){
			if (err){
				l("[saveRoutes] error saving route model to live_persist_config.json", err);
			} else {
				l("[saveRoutes] route model was saved to live_persist_config.json");
			}
		});
	}

	var loadRoutes = function( filename ){
		var raw_data
			, filename = filename || "live_persist_config.json"
			;

		// open the raw_data file
	    try{
	        raw_data = fs.readFileSync("./data/" + filename);
	    } catch(err){
			l("[loadRoutes] error while reading file " + filename, err);
	    }

	    // parse the file contents
	    try{
	        routes = JSON.parse(raw_data);
	        ensureConnected();
	    }catch(err){
	        l("[loadRoutes] error while parsing raw_data file\n", err);
	    }

		return true;
	};

	var reestablishConnection = function() {
		if (!reconnect) {
			reconnect = setInterval(function() {
				if (wsc.readyState !== OPEN) {
					wsc.terminate();
		    		setupWSClient();	
				}
			}, 5000);    		
		}
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

	setupWSClient();
}



var main = function() {

	var port = 9000
		, host = "localhost"
		, persist_server = {}
		;

	var startUp = function() {
		printStartupMsg();
		processArguments();
		captureInput();
		persist_server = exports.persistRoutes({"host": host, "port": port })
	}

	var printStartupMsg = function() {
		l("");
		l("This is a tool for persisting all routes created in the standard spacebrew admin.");
		l("Connecting to spacebrew server at " + host + ":" + port + ".");
		l("");
		l("Here are some useful commands:");
		l("  ls, add, remove, save, load, help, exit");
		l("");
		l("===========================================");
		l("");	
	}

	var processArguments = function(){
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
	 * Set the port of the spacebrew server. defaults to 9000. Can be overridden using the 
	 * 		flag -p or --port when starting up the persistent router.
	 * 		
	 * @type {Number}
	 */
	var setSpacebrewPort = function(newPort){
	    var tempPort = parseInt(newPort);
	    //check that tempPort is a number and within valid port range
	    if (!isNaN(tempPort) && tempPort >= 1 && tempPort <= 65535){
	        port = tempPort;
	    }
	};

	/**
	 * Set the hostname of the device that hosts the spacebrew server. defaults to localhost. Can 
	 * 		be overridden using the flag -h or --host when starting up the persistent router.
	 * 		
	 * @type {String}
	 */
	var setSpacebrewHost = function (newHost){
	    host = newHost;
	}


	var printCommandLineHelp = function (){
		console.log("command line parameters:");
		console.log("\t--port (-p): set the port of the spacebrew server (default 9000)");
		console.log("\t--host: the hostname of the spacebrew server (default localhost)");
		console.log("\t--help (-h): print this help text");
		console.log("examples:");
		console.log("\tnode spacebrew_live_persist.js -p 9011");
		console.log("\tnode spacebrew_live_persist.js -h my-sweet-computer");
	};

	/**
	 * Register the function that processes each line of input from the user
	 */
	var captureInput = function() {
		// the stdin.on calls a function that accepts a command object that we can .toString 
		// to get the raw user input
		stdin.on('data', function(command){
		    runCommand(command.toString());
		});	
	}	

	/**
	 * Utility function for stripping out whitespaces
	 * @param  {string} str The string input by stupid user
	 * @return {string}     The string without leading or trailing whitespace
	 */
	var clean = function (str){
	    return str.replace(/(^\s*|\s*$)/g,'');
	};

	/**
	 * The function that takes a string input command, and does with it as appropriate.
	 * 		This is used by both user input commands only.
	 * 		
	 * @param  {string} command the command to run
	 */
	var runCommand = function(command){
	    //strip leading and trailing spaces
	    command = clean(command.toString());

		if (command == 'exit'){
	        process.exit();
	    } 
	}

	startUp();
}

main();

