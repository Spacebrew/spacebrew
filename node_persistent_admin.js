var processArguments = function(){
    var argv = process.argv;
    for(var i = 2; i < argv.length; i++){
        switch(argv[i]){
            case "--host":
                setDefaultHost(argv[++i]);
                break;
            case "-p":
            case "--port":
                setDefaultPort(argv[++i]);
                break;
            case "-s":
            case "--serverport":
                setDefaultServerPort(argv[++i]);
                break;
            case "-h":
            case "--help":
                printHelp();
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
/**
 * Set the port of the spacebrew server. defaults to 9000. 
 * Can be overridden using the flag -p or --port when starting up the persistent router.
 * node node_persistent_admin.js -p 9011
 * @type {Number}
 */
var setDefaultPort = function(newPort){
    var tempPort = parseInt(newPort);
    //check that tempPort != NaN
    //and that the port is in the valid port range
    if (tempPort == tempPort &&
        tempPort >= 1 && tempPort <= 65535){
        defaultPort = tempPort;
    }
};

var defaultServerPort = 9001;
/**
 * Set the port to open for ws connections. defaults to 9001. 
 * Can be overridden using the flag -s or --serverport when starting up the persistent router.
 * node node_persistent_admin.js -s 9011
 * @type {Number}
 */
var setDefaultServerPort = function(newPort){
    var tempPort = parseInt(newPort);
    //check that tempPort != NaN
    //and that the port is in the valid port range
    if (tempPort == tempPort &&
        tempPort >= 1 && tempPort <= 65535){
        defaultServerPort = tempPort;
    }
};

var defaultHost = "localhost";
var setDefaultHost = function(newHost){
    defaultHost = newHost;
}

var printHelp = function(){
    console.log("command line parameters:");
    console.log("\t--port (-p): set the port of the spacebrew server (default 9000)");
    console.log("\t--serverport (-s): set the port that this will listen on for remote control (default 9001)");
    console.log("\t--host: the hostname of the spacebrew server (default localhost)");
    console.log("\t--help (-h): print this help text");
    console.log("\t--log (-l): not yet implemented");
    console.log("\t--loglevel: not yet implemented");
    console.log("examples:");
    console.log("\tnode node_persistent_admin.js -p 9011 -s 9094");
    console.log("\tnode node_persistent_admin.js -h my-sweet-computer");
};

var forceClose = false;
var doPing = true;

processArguments();

//###########################################
//########  IGNORE EVERYTHING!!!!  ##########
//######### UNTIL FURTHER NOTICE  ###########
//###########################################
//I'm just going to make it work with the current setup, and worry about
//better data structures later.

// Highlevel plan:
// A) put all publishers/subscribers (items) in a list
//    use regex to filter lists
//    connect together all elements in list
//    
//    add CES_Server,broadcast,string,.*,broadcast,string
//    
// B) if we want to use publisher pattern matches in
//    subsbriber filter, then we would have to do a .match 
//    instead of .test, and then do a filter on all subscribers
//    for each publisher that we got a match on.
//    
//    add CES_Server,indiv_(.*),boolean,.*,$1,boolean
//    

//OTHER IDEAS
//we could maintain: 
//  an array of clients (for using .filter)
//  a map of clients with names as keys (for looking up clients by name) each item of which contains....
//   -> an array of publishers and another array of subscribers (for using .filter)
//   -> a map of publishers and another map of subscribers with names as keys
//      (for looking up items by name inside a client) each entry of which contains...
//       -> an array of instances, each of which contains...
//           -> remote address and type information
//
//but how do we remove clients? we could keep a map of maps of client config messages,
//then use those to remove a client before we run an 'config update' from a client.
//
//does this really help us? this creates a nice structure for going from a route request 
//message to making a route. But more often that that we will be handling innocuous route changes by 
//other admins or clients registering/being removed. Mostly we need to be able to handle:
//  A) getting a client config which triggers creating some routes involving that client
//  B) getting a route remove which triggers re-creating that specific route
//  
//So, for A
//  for each item in a client, we see if it is involved in a persistent route
//  find the other end of that persistent route if it exists, if so, route!
//  
//for B
//  see if both sides of the route remove request match a persistent route
//  if so, change 'remove' to 'add' and send it back to the server!
//  
//we will also need to be able to support:
//  C) adding a persistent route after clients have registered
//  D) removing a persistent route after the route has been created
//
//
//A) So, a config comes in, we want to know if the client is involved,
//   so we have an array of clients, try to match each client from a persistent route to the config client
//   if it matches, then we try to match each of that persistent route client's pubs to the config pubs
//   if it matches, 
//###########################################
//############  FURTHER NOTICE  #############
//###########################################


//fs used for file read/write
var fs = require("fs");
//websocket used for conection to spacebrew
var WebSocketClient = require('ws');
//stdin used for user input
var stdin = process.openStdin();

/**
 * startup a websocket server to handle commands over websocket.
 * The port specifies which port to listen on
 * The 'host = 0.0.0.0' specifies to listen to ALL incoming traffic, 
 * not just localhost or a specific IP
 */
var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({port: defaultServerPort,host:'0.0.0.0'});

//print out info:
var l = console.log;
l("This is a CLI admin for maintaining persistent routes in a spacebrew network.");
l("commands:");
l("  ls, add, remove, save, load, help, exit");

/* not actually used now, possibility for future performance enhancement
var pubClientsPR = [];//{name:_____, items:[]}
var subClientsPR = [];//{name:_____, items:[]}
  //items:[{name:_____, types:[]},...]  //types:[{name:____, clients:[]},...]  //routes:[persistentRouteObj,...]
 */

var clients = [];
//var routes = [];//not used right now, the idea was to track acutal routes to compare against persistent routes, but we may not need to do that.
var persistentRoutes = [];

/**
 * Utility function for stripping out whitespaces
 * @param  {string} str The string input by stupid user
 * @return {string}     The string without leading or trailing whitespace
 */
var clean = function(str){
    return str.replace(/(^\s*|\s*$)/g,'');
};

/**
 * The function that takes a string input command, and does with it as appropriate.
 * This is used by both user input commands and incoming websocket commands
 * @param  {string} command the command to run
 */
var runCommand = function(command){
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
        l("persistent routes:");
        for (var i = 0; i < persistentRoutes.length; i++){
            var r = persistentRoutes[i];
            l("  "+(n++)+": "+r.publisher.clientName+","+r.publisher.name+" -> "+r.subscriber.clientName+","+r.subscriber.name);
        }
    } else if (command.indexOf("add") == 0){
        addManagedRoute(command);
    } else if (command.indexOf("remove") == 0){
        var arg = clean(command.substr("remove ".length));
        if (arg == "*"){
            //TODO: send a 'remove' command for all routes that match these persistent routes
            persistentRoutes = [];
            l("removed all managed routes");
        } else {
            //removes the specified persistent route
            var index = parseInt(arg);
            if (index != index){
                //NaN
                l("invalid arguments, must be in the form of \"remove <index>\" where <index> matches the appropriate index as listed via the \"ls\" command");
            } else if (index < 0 || index >= persistentRoutes.length){
                l("index out of range");
            } else{
                var removed = persistentRoutes.splice(index, 1);
                l("removed route");
            }
        }
    } else if (command == "save"){
        fs.writeFile('./data/persistent_config.json', JSON.stringify(persistentRoutes), function(err){
            if (err){
                l("there was an error while writing the config file");
                l(err);
            } else {
                l("config saved to persistent_config.json");
            }
        });
    } else if (command == "load"){
        if (loadConfig(true)){
            l("successfully loaded");
            ensureConnected();
        }
    } else if (command == "help"){
        printHelpText();
    } else if (command == 'exit'){
        process.exit();
    } else {
        l("unrecognized command, use \"help\" to see valid commands");
    }
};

var addManagedRoute = function(command){
    //add the specified persistent route
    //input is either an index pair, or a specified client,pub/sub pairs
    command = command.substr("add ".length);
    parts = command.split(',').map(clean);
    if (parts.length == 4){
        //go through all persistent routes and see if this one exists already
        for (var i = persistentRoutes.length - 1; i >= 0; i--) {
            var currRoute = persistentRoutes[i];
            if (currRoute.publisher.clientName === parts[0] &&
                currRoute.publisher.name === parts[1] &&
                currRoute.subscriber.clientName == parts[2] &&
                currRoute.subscriber.name === parts[3]){
                //this route already exists, abort
                return;
            }
        };
        //add the route to the list
        var newRoute = {
                        publisher:{
                            clientName:parts[0], 
                            name:parts[1], 
                            clientRE:new RegExp("^"+parts[0]+"$"),
                            nameRE:new RegExp("^"+parts[1]+"$")},
                        subscriber:{
                            clientName:parts[2],
                            name:parts[3],
                            clientRE:new RegExp("^"+parts[2]+"$"),
                            nameRE:new RegExp("^"+parts[3]+"$")}};
        persistentRoutes.push(newRoute);
        //and now lets make sure we are all connected!
        
        //for each client
        for (var i = clients.length - 1; i >= 0; i--) {
            var currPubClient = clients[i];
            //if the client is matched by the pub side of this managed route
            if (newRoute.publisher.clientRE.test(currPubClient.name)){
                //for each publisher in that client
                for (var j = currPubClient.publish.messages.length - 1; j >= 0; j--) {
                    var currPub = currPubClient.publish.messages[j]
                    //if the publisher is matched by this managed route
                    if (newRoute.publisher.nameRE.test(currPub.name)){
                        //for each client
                        for (var k = clients.length - 1; k >= 0; k--) {
                            var currSubClient = clients[k];
                            //if the client is matched by the sub side of this managed route
                            if (newRoute.subscriber.clientRE.test(currSubClient.name)){
                                //for each sub in that client
                                for (var m = currSubClient.subscribe.messages.length - 1; m >= 0; m--) {
                                    var currSub = currSubClient.subscribe.messages[m];
                                    //if the subscriber is matched by this managed route
                                    if (newRoute.subscriber.nameRE.test(currSub.name)){
                                        //tell the Server to add the route!
                                        addRoute(currPubClient, currPub, currSubClient, currSub);
                                    }
                                };
                            }
                        };
                    }
                };
            }
        };
        
        //user feedback
        l("added persistent route");
    } else {
        l("invalid arguments, must be in the form of \"add <publisher client>,<publisher name>,<subscriber client>,<subscriber name>\"");
    }
    //THOUGHTS: have 4-part 'add' command only add explicit routes (full names)
    //add a 6-part (5-part) 'add' command that would support reg-ex for names but require explicit 'type'
};

/**
 * listen for 'conneciton' events on the websocket server. 
 * When a new connection comes in, we want to bind to it's 'message' event
 * @param  {WS obj} ws The incoming websocket connection
 */
wss.on('connection', function(ws){
    /**
     * We want to listen to any incoming messages from the websocket client
     * and process them the same as any stdin commands.
     */
    ws.on('message', runCommand);
});

/**
 * Here we process each line of input from the user
 * @param  {obj} command Some command object that I can .toString to get the raw user input
 */
stdin.on('data',function(command){
    runCommand(command.toString());
});

var printHelpText = function(){
    l("This is a CLI admin for maintaining persistent routes in a spacebrew network.");
    l("commands:");
    l("  ls");
    l("    lists all clients, their publishers and subscribers, and the configured persistent routes");
    l("  add <publisher>,<subscriber>");
    l("    adds the route from the specified <publisher> to <subscriber> to the list of maintained routes.");
    l("    you must reference publishers and subscribers by <client_name>,<publisher/subscriber_name>");
    l("    the parts are used as regular expressions to match groups of items together")
    l("    examples:");
    l("      add button,click,signage,power");
    l("      add button,click,.*,trigger");
    l("        (routes the button click publisher to all subscribers named trigger)");
    l("      add .*,.*,.*,.*");
    l("        (routes everything to everything. all routes will respect type matching)")
    l("  remove <index>");
    l("    removes the specified persistent route from being persistent");
    l("    will also break the route if it is currently connected [not yet implemented]");
    l("  save");
    l("    saves the current persistent route list to disk");
    l("  load");
    l("    overwrites the current persistent route list with the one on disk");
    l("    when the server starts up, it will automatically load an existing list from disk");
    l("  exit");
    l("    quits this persistent route admin (same as [ctrl]+c)");
};

var loadConfig = function(expectFile){
    try{
        var config = fs.readFileSync("./data/persistent_config.json");
        try{
            persistentRoutes = JSON.parse(config);
            //for each persistent route, re-define the RexEx
            //we need to do this because, when we stringify/parse the RegEx, 
            //it becomes an Object, not a RegEx
            for (var i = persistentRoutes.length - 1; i >= 0; i--) {
                var curr = persistentRoutes[i];
                var items = [curr.publisher, curr.subscriber];
                for (var j = items.length - 1; j >= 0; j--) {
                    var item = items[j];
                    item.clientRE = new RegExp("^"+item.clientName+"$");
                    item.nameRE = new RegExp("^"+item.name+"$");
                };
            };
            return true;
        }catch(err){
            l("there was an error while parsing the config file");
            l(err);
        }
    } catch(err){
        if (expectFile){
            l("there was an error while reading the config file");
            l(err);
        }
    }
    return false;
};
//auto-load config on startup
loadConfig(false);

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
            //for each persistent route
            for (var k = 0; k < persistentRoutes.length; k++){
                var currRoute = persistentRoutes[k];
                //if the publisher is in a persistent route
                if (currRoute.publisher.clientRE.test(clients[i].name) &&
                    currRoute.publisher.nameRE.test(clients[i].publish.messages[j].name)){
                    //for each subscriber
                    for (var m = 0; m < clients.length; m++){
                        for (var n = 0; n < clients[m].subscribe.messages.length; n++){
                            if (currRoute.subscriber.clientRE.test(clients[m].name) &&
                                currRoute.subscriber.nameRE.test(clients[m].subscribe.messages[n].name)){
                                //if the pub/sub pair match the persistent route
                                //send route message
                                wsClient.send(JSON.stringify({
                                    route:{type:'add',
                                        publisher:{clientName:clients[i].name,
                                                    name:clients[i].publish.messages[j].name,
                                                    type:clients[i].publish.messages[j].type,
                                                    remoteAddress:clients[i].remoteAddress},
                                        subscriber:{clientName:clients[m].name,
                                                    name:clients[m].subscribe.messages[n].name,
                                                    type:clients[m].subscribe.messages[n].type,
                                                    remoteAddress:clients[m].remoteAddress}}
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
    // console.log(data);
    if (data){
        var json = JSON.parse(data);
        //TODO: check if json is an array, otherwise use it as solo message
        //when we hit a malformed message, output a warning
        if (!handleMessage(json)){
            for(var i = 0, end = json.length; i < end; i++){
                handleMessage(json[i]);
            }
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
    } else if (json.config){
        handleConfigMessage(json);
    } else if (json.route){
        if (json.route.type === 'remove'){
            handleRouteRemoveMessage(json);
        }
    } else if (json.remove){
        handleClientRemoveMessage(json);
    } else {
        return false;
    }
    return true;
};

/**
 * Handles a route remove message from the Server. If the route matches a persistent route
 * managed by this admin. Then we will try to re-add the route
 * @param  {json} msg The route remove message from the Server
 */
var handleRouteRemoveMessage = function(msg){
    //see if the pub client, publisher, sub client, and subscriber match a persistent route
    //for each persistent route
    for (var i = persistentRoutes.length - 1; i >= 0; i--) {
        var currRoute = persistentRoutes[i];
        if (currRoute.publisher.clientRE.test(msg.route.publisher.clientName) &&
            currRoute.publisher.nameRE.test(msg.route.publisher.name) &&
            currRoute.subscriber.clientRE.test(msg.route.subscriber.clientName) &&
            currRoute.subscriber.nameRE.test(msg.route.subscriber.name)){
            l("reversing route remove message");
            msg.route.type = 'add';
            wsClient.send(JSON.stringify(msg));
            return;
        }
    };
};

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
    var added = false;
    //see if we are updating a current client
    for (var i = clients.length-1; i >= 0; i--){
        if (areClientsEqual(clients[i], msg.config)){
            //we are updating an existing client
            console.log("################### updated a client");
            clients[i] = msg.config;
            added = true;
        }
    }
    //we didn't find it
    //add it if necessary
    if (!added){
        console.log("################ added a client");
        clients.push(msg.config);
    }

    //************************
    //****  FAIR WARNING  ****
    //************************
    //
    //The following crazy set of loops was originally set up to go through all publishers exposed 
    //by this client and connect them to the correct subscribers
    //The second step was to expand it to handle the reverse case as well (connecting all appropriate
    //publishers to this client's subscribers).
    //For now, the variable names within the loops have been kept to reflect the original publisher to subscriber
    //methodology because that seems easier to follow than more generic names 
    //such as "primary", "secondary" or whatever else.
    var items = [{'first':'publisher', 'second':'publish', 'third':'subscriber', 'fourth':'subscribe', 'primaryI':0, 'secondaryI':2},
                 {'first':'subscriber', 'second':'subscribe', 'third':'publisher', 'fourth':'publish', 'primaryI':2, 'secondaryI':0}];
    //see if any persistent routes affect this client
    //for each direction
    for (var h = 0, e = items.length; h < e; h++) {
        var item = items[h];
        var pI = item['primaryI'],
            sI = item['secondaryI'];
        //for each persistent route
        for (var i = persistentRoutes.length - 1; i >= 0; i--) {
            var currRoute = persistentRoutes[i];
            //if the client matches a publisher persistent route
            if (currRoute[item['first']].clientRE.test(msg.config.name)){
                //get all the publishers from this client that match this persistent route
                var pubMatch = msg.config[item['second']].messages.filter(function(m){
                    return currRoute[item['first']].nameRE.test(m.name);
                });
                if (pubMatch.length == 0){
                    continue;
                }
                //find all the subscribers that match this persistent route
                var subClientMatch = clients.filter(function(c){
                    return currRoute[item['third']].clientRE.test(c.name);
                });
                //for each sub client, get a list of subscribers from that client that match this pers. route
                for (var j = subClientMatch.length - 1; j >= 0; j--) {
                    var currSubClient = subClientMatch[j];
                    var subMatch = currSubClient[item['fourth']].messages.filter(function(m){
                        return currRoute[item['third']].nameRE.test(m.name);
                    });
                    //for each sub, for each pub, send an 'add route' message
                    for (var k = subMatch.length - 1; k >= 0; k--) {
                        for (var p = pubMatch.length - 1; p >= 0; p--) {
                            var args = [];
                            args[pI] = msg.config;
                            args[pI+1] = pubMatch[p];
                            args[sI] = currSubClient;
                            args[sI+1] = subMatch[k];
                            addRoute.apply(this, args);//(msg.config, pubMatch[p], currSubClient, subMatch[k]);
                        };
                    };
                };
            };
        };
    };
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

var setupWSClient = function(){ 
    // create the wsclient and register as an admin
    wsClient = new WebSocketClient("ws://"+defaultHost+":"+defaultPort);
    wsClient.on("open", function(conn){
        console.log("connected");
        var adminMsg = { "admin": [
            {"admin": true}
        ]};
        wsClient.send(JSON.stringify(adminMsg));
    });
    wsClient.on("message", receivedMessage);
    wsClient.on("error", function(){console.log("ERROR"); console.log(arguments);});
    wsClient.on("close", function(){console.log("CLOSE"); console.log(arguments);});
}

// there is an Interval set up below 
// which will re-try the connection if it fails
setupWSClient();

/**
 * Ready States [copied from WebSocket.js]
 */

var CONNECTING = 0;
var OPEN = 1;
var CLOSING = 2;
var CLOSED = 3;
setInterval(function(){if (wsClient.readyState !== OPEN){wsClient.terminate(); setupWSClient()}}, 10000);