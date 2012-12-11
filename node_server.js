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
 * Set the port to open for ws connections. defaults to 9000. 
 * Can be overridden using the flag -p or --port when starting up the server.
 * node node_server.js -p 9011
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
    console.log("\t--pinginterval: the number of ms between pings (implies --ping, default 1000 [1 second])");
    console.log("\t--log (-l): not yet implemented");
    console.log("\t--loglevel: not yet implemented");
    console.log("examples:");
    console.log("\tnode node_server.js -p 9011 -t 1000 --pinginterval 1000");
    console.log("\tnode node_server.js --noping");
};

var forceClose = false;
var doPing = true;

processArguments();

/**
 * startup the websocket server.
 * The port specifies which port to listen on
 * The 'host = 0.0.0.0' specifies to listen to ALL incoming traffic, 
 * not just localhost or a specific IP
 */
var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({
        port: defaultPort,
        host:'0.0.0.0'});

/**
 * keeps a list of all the current websocket connections.
 * @type {Array}
 */
var allconnections = [ ]; // list of currently connected clients (users) sockets

/**
 * A list of websocket connections that have identified themselves as spacebrew Clients.
 * A Client identifies themselves by sending a config message as outlined in the examples.
 * @type {Array}
 */
var trustedClients = []; // list of clients that have sent names
// trustedClient = {subscribers:{<name>:{<type>:{name:____,type:____,publishers:[{client:<client_pointer>,publisher:<pub_pointer>}]}}}
//                  publishers:{<name>:{<type>:{name:____,type:____,default:____,subscribers:[{client:<client_pointer>,subscriber:<sub_pointer>}]}}}}

/**
 * A list of websocket connections that have identified themselves as Admins.
 * An Admin identifies themselves by sending an admin message as shown in the various Admin implementations.
 * @type {Array}
 */
var adminConnections = [];

console.log("\nRunning Spacebrew, start with argument '--help' to see available configuration arguments.");
console.log("More info at http://www.spacebrew.cc");

/**
 * This creates an array of websocket messages to pass in bulk to new Admins
 * in order to catch the Admin up to speed on the current state of the Server.
 * TODO: cache this array of messages, or build it incrementally so we don't have to run
 * this expensive operation every time an Admin connects.
 * @return {Array} An array of messages to catch the new Admin up with the current state
 */
var buildUpdateMessagesForAdmin = function(){
    var output = [];
    //re-create the 'config' messages
    for(var i = 0, end = trustedClients.length; i < end; i++){
        var currClient = trustedClients[i];
        var currMsg = {config:currClient.config};
        output.push(currMsg);
    }
    //now re-create the 'route' messages
    //we only need to build from one side, so we only look at publishers
    for(var i = 0, end = trustedClients.length; i < end; i++){
        var currClient = trustedClients[i];
        for (var publisherName in currClient.publishers){
            for (var type in currClient.publishers[publisherName]){
                var publisherObj = {clientName:currClient.name,
                                    name:publisherName,
                                    type:type,
                                    remoteAddress:currClient.remoteAddress};
                var publisher = currClient.publishers[publisherName][type];
                for (var j = 0; j < publisher.subscribers.length; j++){
                    var subscriber = publisher.subscribers[j];
                    currMsg = {route:{type:'add',
                                        publisher:publisherObj,
                                        subscriber:{clientName:subscriber.client.name,
                                                    name:subscriber.subscriber.name,
                                                    type:subscriber.subscriber.type,
                                                    remoteAddress:subscriber.client.remoteAddress}}};
                    output.push(currMsg);
                }
            }
        }
    }
    return output;
};

// WebSocket server
/**
 * When a new client connects, we will add it to our list of connections
 * and setup the appropriate callbacks
 * @param  {obj} ws The ws object that contains all the connection info and provides callback hooks
 */
wss.on('connection', function(ws) {
    console.log("someone connected");

    var connection = ws;
    allconnections.push(ws);

    /**
     * We will handle all messages from connections here. This includes
     * admin, config, message, and routing messages for setting up, managing, and communicating
     * via spacebrew. This is the backbone of spacebrew.
     * @param  {obj} message The incoming message from an admin or client
     */
    ws.on('message', function(message) {
        //console.log("<"+message+">");
        var bValidMessage = false;
        if (message) {
            // process WebSocket message
            try{
                var tMsg = JSON.parse(message);
            }catch(err){
                console.log("error while parsing message as JSON");
                return;
            }

            try{
                if (tMsg['config']) {
                    bValidMessage = handleConfigMessage(connection, tMsg);
                } else if (tMsg['message']) {
                    bValidMessage = handleMessageMessage(connection, tMsg);
                } else if (tMsg['admin']) {
                    connection.spacebrew_is_admin = true;
                    connection.send(JSON.stringify(buildUpdateMessagesForAdmin()));
                    adminConnections.push(connection);
                    bValidMessage = true;
                } else if (tMsg['route']){
                    bValidMessage = handleRouteMessage(connection, tMsg);
                } else {
                    console.log("unrecognized message type. Use one of config, message, admin, or route");
                }
                if (bValidMessage){
                    //console.log("forwarding to admins");
                    sendToAdmins(tMsg);
                } else {
                    console.log("message marked as invalid, ignoring");
                }
            } catch (err){
                console.log("ERROR on line <" + err.lineNumber + "> while processing message");
                console.log(err.stack);
            }
        }
    });

    /**
     * When a websocket connection is closed, we want to cleanup the Client
     * (including all publishers and subscribers) associated with that connection,
     * as well as any routes that Client was involved in. Finally we will remove the
     * Client or Admin from their respective connection list and remove the connection
     * from allconnections. While a Client is being cleaned up, all route remove messages are sent
     * to the Admins and finally a Client remove message is sent to the Admins.
     * @param  {obj} ws The object containing information about the connection that is being closed
     */
    ws.on('close', function(ws) {
        cleanupClosedConnections();
    });

    ws.on("pong", function(e){
        connection.spacebrew_pong_validated = true;
    });

    ws.on("error", function(e) {
        console.log("ERROR!");
        console.log(e);
        try{
            console.log(arguments);
            console.log(JSON.stringify(e));
        } catch (ne){
            console.log(keys(e));
        }
    });
});

/**
 * A helper function to handle routing messages from a publisher to the appropriate subscribers.
 * @param  {ws Connection Obj} connection The connection that the message came in on
 * @param  {json} tMsg The message from the publisher which should be forwarded to its subscribers
 * @return {boolean}      True iff the message comes from a publisher that exists
 */
var handleMessageMessage = function(connection, tMsg){
    //find the associated client
    //get the appropriate publisher on that client
    //for each subscriber to that publisher,
    //translate the message to the subscriber's name
    //and send the type & value
    if (!connection.spacebrew_client_list){
        console.log("this connection has no registered clients");
        return false;
    }
    var currClient = connection.spacebrew_client_list[tMsg.message.clientName];
    if (!currClient){
        console.log("the client: " + tMsg.message.clientName + " does not belong to this connection");
        return false;
    }
    var bValidMessage = false;
    //high level thoughts:
    //  Change to [<type>][<pub/sub Name>] to access publishers and subscribers for a client.
    //    This should help speed up searching since the first level will usually be 3 bins max
    //    and then the second level has many branches instead of the first level having all
    //    the branches and the second level having one branch. Keep in mind that we should support
    //    user-defined types beyond String, Boolean, Range. Is it quicker to rely on the hash-map
    //    to quickly find elements or should be implement our own binary search? 
    //    (sounds like we are going too deep) But maybe we could implement a priority queue, publishers
    //    that publish often are more likely to publish.

    //add the remote address for the admins
    tMsg['message'].remoteAddress = getClientAddress(connection);

    var pub = currClient.publishers[tMsg.message.name];
    if (!pub){
        console.log("an un-registered publisher name: " + tMsg.message.name);
        return false;
    } else {
        pub = pub[tMsg.message.type];
        if (!pub){
            console.log("an un-registered publisher type: " + tMsg.message.type + " with name: " + tMsg.message.name);
            return false;
        } else {
            bValidMessage = true;
            for(var j = pub.subscribers.length - 1; j >= 0; j--){
                var currSub = pub.subscribers[j];
                //we don't want an issue with one subscriber to block messages
                //to other subscribers
                try{
                    currSub.client.connection.send(JSON.stringify({message:{
                        name:currSub.subscriber.name,
                        type:tMsg.message.type,
                        value:tMsg.message.value
                    }}));
                } catch(err){
                    console.log("failed sending to: " + currSub.client.name + ", " +currSub.subscriber.name + " - " + err);
                }
            }
        }
    }
    return bValidMessage;
};

/**
 * A helper function to handle adding and removing routes. This will update the neccessary
 * data structures
 * @param  {json} tMsg The message from an Admin specifying whether to add or remove a route
 * @return {boolean}      True iff the route message was valid and changed the state of the server.
 */
var handleRouteMessage = function(connection, tMsg){
    //Check that the message came from an Admin connection
    //  note that 'connection' will be undefined for simulated route messages
    //  from within the Server
    if (connection && !connection.spacebrew_is_admin){
        return false;
    }
    //expected message format:
    //{route:{type:<add/remove>,
    //        publisher:{clientName:_____,name:____,type:_____,remoteAddress:_____},
    //        subscriber:{clientName:____,name:____,type:____,remoteAddress:____}}}
    var bValidMessage = false;
    var pub = tMsg.route.publisher, sub = tMsg.route.subscriber;
    //ignore if types do not match
    if (pub.type === sub.type){
        var pubEntry, subEntry, pubClient, subClient;
        //find the appropriate entry in trustedClients
        var tcLength = trustedClients.length;
        for(var i = 0; i < tcLength && (pubEntry === undefined || subEntry === undefined); i++){
            if (trustedClients[i].name === pub.clientName 
                && trustedClients[i].remoteAddress === pub.remoteAddress){
                pubClient = trustedClients[i];
                //TODO: check that the Client has the specified publisher, in order to head off any errors at the pass.
                // This will allow us to send back some helpful error message to the Admin in case we implement such functionality.
                // (same for subscriber)
                pubEntry = pubClient.publishers[pub.name][pub.type];
            }
            if (trustedClients[i].name === sub.clientName
                && trustedClients[i].remoteAddress === sub.remoteAddress){
                subClient = trustedClients[i];
                subEntry = subClient.subscribers[sub.name][sub.type];
            }
        }
        //if we have found a matching publisher and subscriber, 
        //handle the adding or deleting of references
        //and notify the calling function that they can forward the message
        //to all the admins
        if (pubEntry && subEntry){
            if (tMsg.route.type == "add"){
                //If the designated publisher and subscriber are already routed together
                //then ignore this message
                if (areRoutedTogether(pubClient, pubEntry, subClient, subEntry)){
                    return false;
                }
                //if not, route them
                bValidMessage = true;
                pubEntry.subscribers.push({client:subClient,subscriber:subEntry});
                subEntry.publishers.push({client:pubClient,publisher:pubEntry});
            } else if (tMsg.route.type == "remove"){
                //If the designated publisher and subscriber are NOT routed together currently
                //then ignore this message
                if (!areRoutedTogether(pubClient, pubEntry, subClient, subEntry)){
                    return false;
                }
                //if they are currently routed, then break the connection
                bValidMessage = true;
                var entry;
                var items = [{'first':subEntry, 'second':pubEntry.subscribers, 'third':'subscriber'},
                             {'first':pubEntry, 'second':subEntry.publishers, 'third':'publisher'}];
                for (var j = 0; j < items.length; j++){
                    var item = items[j];
                    for(var i = item['second'].length - 1; i >= 0; i--){
                        entry = item['second'][i];
                        if (entry[item['third']] === item['first']){
                            item['second'].splice(i, 1);
                        }
                    }
                }
            } else {
                bValidMessage = false;
            }
        }
    }
    return bValidMessage;
};

/**
 * logs all the currently trusted clients by name for debugging purposes
 */
var printAllTrustedClients = function(){
    console.log("Here are the current trustedClients "+trustedClients.length);

    for (var i=0; i<trustedClients.length; i++) {
        console.log(trustedClients[i]['name']);
    }
};

var getClientAddress = function(connection){
    try{
        return connection._socket._handle.getpeername().address;//connection.upgradeReq.headers.host;
    } catch (e){}
    console.log("unable to access remote address");
    return "unknown";
};

/**
 * A helper function used to parse config messages from Clients.
 * @param  {ws Connection Obj} connection The connection that the message came in on
 * @param  {json} tMsg       The config message from the Client
 * @return {boolean}            True iff the Client you are trying to config does not already exist
 */
var handleConfigMessage = function(connection, tMsg){
    var bValidMessage = false;
    var trustedClient = undefined;
    var msgName = tMsg['config']['name'];
    var msgAddress = getClientAddress(connection);
    //check if this connection already has this client defined
    if (connection.spacebrew_client_list &&
        connection.spacebrew_client_list[msgName]){
        //the client matches one already defined for this connection,
        //so lets update the config
        console.log("client is sending a config update");
        trustedClient = connection.spacebrew_client_list[msgName];
    } else {
        //check that the name, remote address pair is not already taken
        for (var i = trustedClients.length - 1; i >= 0; i--) {
            if (trustedClients[i]['name'] === msgName &&
                trustedClients[i]['remoteAddress'] === msgAddress){
                //name, remote address pair is already taken.
                //check to see if the existing connection has been verified
                if (trustedClients[i].connection.spacebrew_pong_validated){
                    //ignore this config
                    console.log("client is already connected -- denying new connection");
                    return false;
                } else {
                    console.log("client is already registered -- replacing with new connection");
                    //we will replace the existing client with the new one on this new connection
                    //TODO: either remove all routes involving this client we removed, or migrate all connections to the new client
                    //starting with removing all routes since the client might have the same name, but a different config
                    removeRoutesInvolvingClient(trustedClients[i]);
                    //remove it from the admin, so nothing funny happens when the new one gets added
                    sendToAdmins({remove:{name:trustedClients[i].name, remoteAddress:trustedClients[i].remoteAddress}});

                    //remove the old client from the list
                    trustedClients.splice(i, 1);
                }
            }
        };
    }

    if (!trustedClient){
        //the name is available, and this is a new client
        if (!connection.spacebrew_client_list){
            connection.spacebrew_client_list = {};
        }
        trustedClient = {
            "name": msgName,
            "remoteAddress": msgAddress,
            "description": "",
            "connection": connection,
            "publishers": {},
            "subscribers": {},
            "config":""
        };
        console.log("Client is new");

        trustedClients.push(trustedClient);
        connection.spacebrew_client_list[msgName] = trustedClient;
        console.log("client added");
        bValidMessage = true;
        printAllTrustedClients();
    }

    //now that we have the base data structure, we can update it to match the new
    //config message, Regardless of whether or not this is a pre-existing client.
    bValidMessage = true;
    //add the remote address to the message for the admins
    tMsg['config'].remoteAddress = trustedClient.remoteAddress;
    trustedClient.config = tMsg['config'];
    trustedClient.description = tMsg['config']['description'];
    var tSubs = [];
    if (tMsg.config.subscribe && tMsg.config.subscribe.messages){
        //tSubs = tMsg.config.subscribe.messages;
        //we will copy over the data from the config so that we don't 
        //corrupt the original config message
        for (var i = tMsg.config.subscribe.messages.length - 1; i >= 0; i--) {
            var currSub = tMsg.config.subscribe.messages[i];
            currSub.type = currSub.type.toLowerCase();
            tSubs.push({name:currSub.name, type:currSub.type, default:currSub.default});
        };
    } else {
        tMsg.config['subscribe'] = {};
        tMsg.config.subscribe['messages'] = [];
    }
    var tPubs = [];
    if (tMsg.config.publish && tMsg.config.publish.messages){
        //tPubs = tMsg.config.publish.messages;
        //we will copy over the data from the config so that we don't 
        //corrupt the original config message
        for (var i = tMsg.config.publish.messages.length - 1; i >= 0; i--) {
            var currPub = tMsg.config.publish.messages[i];
            currPub.type = currPub.type.toLowerCase();
            tPubs.push({name:currPub.name, type:currPub.type, default:currPub.default});
        };
    } else {
        tMsg.config['publish'] = {};
        tMsg.config.publish['messages'] = [];
    }
    //we are storing in a structure
    // trustedClient = {subscribers:{<name>:{<type>:{name:____,type:____,publishers:[{client:<client_pointer>,publisher:<pub_pointer>}]}}}
    //                  publishers:{<name>:{<type>:{name:____,type:____,default:____,subscribers:[{client:<client_pointer>,subscriber:<sub_pointer>}]}}}}
    //so you need to access them by trustedClients[i][<sub_or_pub>][<name>][<type>]
    //
    //The 'hash' variable is used to keep a list of publishers or subscribers defined by this config
    //message. After we add all the new or updated publishers and subscribers to our internal data structures, 
    //we can check against the 'hash' variable and remove any now undefined publishers and subscribers.
    var items = [{'first':tSubs, 'second':trustedClient.subscribers, 'third':'publishers', 'fourth':'subscriber', 'fifth':'publisher'}, 
                 {'first':tPubs, 'second':trustedClient.publishers, 'third':'subscribers', 'fourth':'publisher', 'fifth':'subscriber'}];
    for (var j = 0; j<items.length; j++){
        var item = items[j];
        var hash = {};
        //add new subscribers/publishers to hash
        for (var i=0; i<item['first'].length; i++) {
            if (!hash[item['first'][i].name]){
                hash[item['first'][i].name] = {};
            }
            hash[item['first'][i].name][item['first'][i].type] = 'exists';
            if (!item['second'][item['first'][i].name]){
                item['second'][item['first'][i].name] = {};
            }
            if (!item['second'][item['first'][i].name][item['first'][i].type]){
                item['first'][i][item['third']] = [];
                item['second'][item['first'][i].name][item['first'][i].type] = item['first'][i];
            }
        }
        //remove stale subscribers/publishers from our data structures
        //TODO:break any routes associated with now undefined publishers and subscribers
        for (var itemName in item['second']){
            if (hash[itemName] === undefined){
                //remove each route involving these items
                for (var itemType in item['second'][itemName]){
                    var currBase = item['second'][itemName][itemType];
                    removeRoutesInvolving(currBase, trustedClient);
                }
                delete item['second'][itemName];
            } else {
                for (var itemType in item['second'][itemName]){
                    if (hash[itemName][itemType] === undefined){
                        removeRoutesInvolving(item['second'][itemName][itemType], trustedClient);
                        delete item['second'][itemName][itemType];
                    }
                }
            }
        }
    }
    return bValidMessage;
}

/**
 * This will remove all the routes involving the specified item (either publisher or subscriber)
 * @param  {Item Obj} item   The item (either publisher or subscriber) to remove all routes to/from
 * @param  {Client Obj} client The client that provides this publisher or subscriber to spacebrew
 */
var removeRoutesInvolving = function(item, client){
    var currBase = item;
    var isPublisher = (currBase.publishers === undefined);
    var myType = (isPublisher ? 'publisher' : 'subscriber'),
        otherType = (isPublisher ? 'subscriber' : 'publisher'),
        otherTypePlural = (isPublisher ? 'subscribers' : 'publishers');
    var toSend = [];//an array of messages to send to admins to tell them about the route updates

    //for each item that the passed-in item is connected to, 
    //create, process, and send a route remove connection
    for (var i = currBase[otherTypePlural].length - 1; i >= 0; i--) {
        var currLeaf = currBase[otherTypePlural][i];
        var messageContent = {type:'remove'};
        messageContent[otherType] = {clientName:currLeaf.client.name,
                                        name:currLeaf[otherType].name,
                                        type:currLeaf[otherType].type,
                                        remoteAddress:currLeaf.client.remoteAddress};
        messageContent[myType] = {clientName:client.name,
                                        name:currBase.name,
                                        type:currBase.type,
                                        remoteAddress:client.remoteAddress};
        console.log("################ removing internally ################");
        console.log(JSON.stringify(messageContent));
        //Here I use the standard 'route removing' function to actually 
        //clean up all the data structures related to this route.
        if (handleRouteMessage(undefined, {route:messageContent})){
            console.log("successfully removed route, telling admins");
            toSend.push({route:messageContent});
        }
    };

    //bulk update admins at the end
    //OPTION: return this array and have the calling function deal with notifying the
    //admins, this will allow all route remove messages for an entire client to be sent together
    //instead of just tall route remove messages for a particular publisher or subscriber
    if (toSend.length > 0){
        sendToAdmins(toSend);
    }
};

/**
 * This will remove all the routes involving the specified client
 * @param  {Client Obj} client The client to remove all routes to/from
 */
var removeRoutesInvolvingClient = function(client){
    //for each publisher
    //for each subscriber to that publisher
    //remove route
    //for each subscriber
    //for each publisher to that subscriber
    //remove route
    var items = [{'first':client.publishers, 'second':'subscribers', 'third':'subscriber', 'fourth':'publisher'},
                 {'first':client.subscribers, 'second':'publishers', 'third':'publisher', 'fourth':'subscriber'}];
    for (var k = 0; k < items.length; k++){
        var item = items[k];
        for (var itemName in item['first']){
            for (var itemType in item['first'][itemName]){
                var currBase = item['first'][itemName][itemType];
                //TODO: change this to return list of messages instead of sending messages itself
                //and add note about why (hint: persistent admin)
                removeRoutesInvolving(currBase, client);
                //var numItems = currBase[item['second']].length;
                // while(numItems--){
                //     var currLeaf = currBase[item['second']][numItems];
                //     var messageContent = {type:'remove'};
                //     messageContent[item['third']] = {clientName:currLeaf.client.name,
                //                                     name:currLeaf[item['third']].name,
                //                                     type:currLeaf[item['third']].type,
                //                                     remoteAddress:currLeaf.client.remoteAddress};
                //     messageContent[item['fourth']] = {clientName:trustedClients[i].name,
                //                                     name:currBase.name,
                //                                     type:currBase.type,
                //                                     remoteAddress:trustedClients[i].remoteAddress};
                //     //Here I use the standard 'route removing' function to actually 
                //     //clean up all the data structures related to this route.
                //     if (handleRouteMessage(undefined, {route:messageContent})){
                //         //TODO: add the route remove message to an array,
                //         //and send that array in bulk to all the admins at the end
                //         sendToAdmins({route:messageContent});
                //     }
                // }
            }
        }
    }
}

/**
 * Checks to see if the specified publisher and subscriber are already routed together
 * @param  {Client Obj} pubClient The Client object from the trustedClients array that contains this publisher
 * @param  {Pub Obj} pubEntry  The publisher entry that is the specific publisher from pubClient
 * @param  {Client Obj} subClient The Client object from the trustedClients array that contains this subscriber
 * @param  {Sub Obj} subEntry  The subscriber entry that is the specific subscriber from subClient
 * @return {boolean}           True iff the publisher and subscriber are routed together
 */
var areRoutedTogether = function(pubClient, pubEntry, subClient, subEntry){
    var numSubscribers = pubEntry.subscribers.length;
    while(numSubscribers--){
        var currSub = pubEntry.subscribers[numSubscribers];//{client:{},subscriber:{}}
        if (currSub.subscriber.type === subEntry.type &&
            currSub.subscriber.name === subEntry.name &&
            currSub.client.name === subClient.name &&
            currSub.client.remoteAddress === subClient.remoteAddress){
            //the pub/sub are routed together
            return true;
        }
    }
    //we did not encounter a matching subscriber that is routed to from the specified publisher
    return false;
};

/**
 * A helper function to send the specified message to all registered Admins.
 * @param  {json} json The message to forward to all Admins
 */
var sendToAdmins = function(json){
    var toSend = JSON.stringify(json);
    for(var i = adminConnections.length - 1; i >= 0; i--){
        adminConnections[i].send(toSend);
    }
};

var cleanupClosedConnections = function(){
    // close user connection
    console.log("close");
    //console.log(ws);
    var removed = [];
    //remove clients
    //console.log("There are this many clients: "+trustedClients.length);

    for(var i = 0; i < trustedClients.length;){
        //console.log(trustedClients);
        if (!trustedClients[i].connection._socket){
            removeRoutesInvolvingClient(trustedClients[i]);
            removed.push({name:trustedClients[i].name, remoteAddress:trustedClients[i].remoteAddress});
            trustedClients.splice(i, 1);
        } else {
            i++;
        }
    }

    //remove Admins
    //console.log("There are admins: "+ adminConnections.length);
    for(var i = 0; i < adminConnections.length;){
        if (adminConnections[i]._socket == null){
            adminConnections.splice(i, 1);
        } else {
            i++;
        }
    }
    //remove connections
    for(var i = 0; i<allconnections.length;){
        if (allconnections[i]._socket == null){
            allconnections.splice(i, 1);
        } else {
            i++;
        }
    }

    //tell the Admins about removed Clients
    //do this after any disconnected admins are removed.
    sendToAdmins({remove:removed});
};

/**
 * Periodically send ping messages to all clients, when they return the ping, we can mark them as active.
 */
var pingAllClients = function(){
    for (var i = trustedClients.length - 1; i >= 0; i--) {
        var currConn = trustedClients[i].connection;
        try{
            if (currConn.spacebrew_pong_validated === undefined
                || currConn.spacebrew_pong_validated === true){
                currConn.spacebrew_pong_validated = false;
                currConn.spacebrew_first_pong_sent = Date.now();
                //console.log("setting validated = false");
            } else if (forceClose 
                        && currConn.spacebrew_pong_validated === false
                        && (currConn.spacebrew_first_pong_sent + closeTimeout) < Date.now()){
                //10-second timeout
                currConn.close();
                //cleanupClosedConnections();
                //console.log("closed connection");
                continue;
            }
            currConn.ping();
        } catch(err){
            console.log("CAN'T PING CLIENT, CONNECTION ALREADY CLOSED");
        }
    };
}

if (doPing){
    setInterval(pingAllClients, pingIntervalTime);
}