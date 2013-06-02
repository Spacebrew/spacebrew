/**
 * Spacebrew Live Persist Module
 * -----------------------------
 * 
 * This module persists all routes added via a standard spacebrew admin. To
 * run this module a standalone app you should use the node_persisten_live.js
 * script.
 *
 * Latest Updates:
 * - checks if data/routes/live folder already exists, and if not, it creates folder
 * - changed error message when script attempts to load a live routes file that 
 * 	 does not exist
 *
 * @author: 	Julio Terra
 * @filename: 	node_server.js
 * @date: 		June 1st, 2013
 * @updated with version: 	0.3.1 
 *
 */

var fs = require("fs")					// fs used for file read/write
	, WebSocketClient = require('ws') 	// websocket used for conection to spacebrew
	, logger = require('./logger')		// logger used to log messages
	, livePersister = exports			// set livePersister to be a node module
	, WS_OPEN = 1 						// websockets library open state constant 
	;

/**
 * Live Persister module that makes sure that all routes connected via an standard
 * 		Admin remain connected if an app disconnects and then reconnects, or 
 * 		if the server fails. 
 * 		
 * @param  {Object} opts 	Object that holds the following optional settings for 
 *                          the livePersister:
 *                          * port: port number of the Spacebrew server
 *                          * host: host of the spacebrew server
 *                          * autosave: saves routes to file
 *                          * load: loads routes from file on startup
 *                          * loadFile: speficies name of file to load
 *                          * logLevel: sets the log level for the app
 *                          
 */
livePersister.persistRoutes = function( opts ){

	// Import Modules and Configure Input and Output streams
	var reconnect = undefined			// holds timer that maintains server connection
		;

	var port = opts.port || 9000
		, host = opts.host || "localhost"
		, autosave = opts.autosave || true
		, load = opts.load || true
		, configFile = opts.loadFile || "live_persist_config.json"
		;

	var clients = []
		, routes = []
		;

	logger.debugLevel = opts.logLevel || "error";

	/**
	 * check if data/routes directory already exists, and if not, then create it.
	 */
	var setupLogDirectory = function () {
		var data_dir = __dirname + "/data"
			, routes_dir = __dirname + "/data/routes"
			, live_dir = __dirname + "/data/routes/live"
			;

		// check if data folder exists
		try {
			fs.statSync(data_dir);
		} 
		catch (e) {
			fs.mkdir(data_dir);	
			logger.log("info", "creating data directory");
		}

		// check if data/routes folder exists
		try {
			fs.statSync(routes_dir);
		} 
		catch (e) {
			fs.mkdir(routes_dir);	
			logger.log("info", "creating data/routes directory");
		}

		// check if data/routes folder exists
		try {
			fs.statSync(live_dir);
		} 
		catch (e) {
			fs.mkdir(live_dir);	
			logger.log("info", "creating data/routes/live directory");
		}
	}	

	var setupWSClient = function(){ 

		// create the wsclient to connect to spacebrew
		wsc = new WebSocketClient("ws://" + host + ":" + port);

		// configure the spacebrew admin client once connection stablished
		wsc.on("open", function(conn){
			logger.log("info", "[ws.open] connected to spacebrew \n");

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
			if (load) loadRoutes();
		});

		// handle messages
		wsc.on("message", receivedMessage);

		// handle websocket error events
		wsc.on("error", function(){
			logger.log("error", "[ws.onerror] spacebrew Connection Error"); 
			logger.log("error", arguments);
			if (wsc.readyState != WS_OPEN) reestablishConnection();
		});

		// handle websocket close events
		wsc.on("close", function(){
			logger.log("info", "[on.close] spacebrew Connection Closed"); 
			logger.log("info", arguments);
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
	var receivedMessage = function(data){
	    logger.log("info", "[receivedMessage] received new message from spacebrew server: ")
	    logger.log("info", data);

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
	        	logger.log("info", "[receivedMessage] message is not valid: ");
			    logger.log("info", data);
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
			logger.log("info", "[handleMessage] add client request received: ");
			logger.log("info", json);
	        handleConfigMessage(json);
	    } 

	    else if (json.route){
			logger.log("info", "[handleMessage] route request received: ");
			logger.log("info", json);
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

		logger.log("info", "[handleRouteRemoveMessage] request received ");
		logger.log("info", msg);

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
				logger.log("info", "[handleRouteRemoveMessage] removed route at index " + i);
			}
		};

	    saveRoutes();
	};

	/**
	 * Handles add routes from the spacebrew
	 * @param {json} msg 	The route remove message from the Server
	 */
	var handleRouteAddMessage = function(msg){

		logger.log("info", "[handleRouteAddMessage] request received ");
		logger.log("info", msg);

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

		logger.log("info", "[handleRouteAddMessage] new route: ");
		logger.log("info", newRoute);
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
	                logger.log("info", "[handleClientRemoveMessage] removed a client");
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
	            logger.log("info", "[handleConfigMessage] updating a client");
	            clients[i] = msg.config;
	            existing = true;
	        }
	    }
	    // otherwise add client to array
	    if (!existing){
	        logger.log("info", "[handleConfigMessage] adding a new client");
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

	/**
	 * Save routes to the file
	 * @return {[type]} [description]
	 */
	var saveRoutes = function() {
		fs.writeFile('./data/routes/live/' + configFile, JSON.stringify(routes), function(err){
			if (err){
				logger.log("warn", "[saveRoutes] error saving route model to live_persist_config.json");
				logger.log("warn", err);
			} else {
				logger.log("info", "[saveRoutes] route model was saved to live_persist_config.json");
			}
		});
	}

	/**
	 * Loads routes from the specified file
	 * 
	 * @param  {String} filename  Name of file that should be loaded
	 * @return {Boolean}          Returns true if data was properly loaded
	 */
	var loadRoutes = function(){
		var raw_data;

		// open the raw_data file
	    try{
	        raw_data = fs.readFileSync("./data/routes/live/" + configFile);
	    } catch(err){
			logger.log("warn", "[loadRoutes] live routes config file does not exist " + configFile);
			return false;
	    }

	    // parse the file contents
	    try{
	        routes = JSON.parse(raw_data);
	        ensureConnected();
	    }catch(err){
	        logger.log("warn", "[loadRoutes] unable to parse content from file ");
			return false;
	    }

		return true;
	};

	/**
	 * Sets a timer for attempting to reconnect to the Spacbrew server again. Method is 
	 * 		called when connection to Spacebrew server is closed.
	 */
	var reestablishConnection = function() {
		if (!reconnect) {
			reconnect = setInterval(function() {
				if (wsc.readyState !== WS_OPEN) {
					logger.log("info", "[reestablishConnection] attempting to reconnect");
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

	setupLogDirectory();
	setupWSClient();
}