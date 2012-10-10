/**
 * The port to open for ws connections. defaults to 9000. 
 * Can be overridden by a first argument when starting up the server.
 * node node_server.js 9011
 * @type {Number}
 */
var spacePort = 9000;
if (process.argv[2]) {
    var tempPort = parseInt(process.argv[2]);
    //check that tempPort != NaN
    //and that the port is in the valid port range
    if (tempPort == tempPort &&
        tempPort >= 1 && tempPort <= 65535){
        spacePort = tempPort;
    }
}

var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({port: spacePort,host:'0.0.0.0'});
var http = require('http');

/**
 * keeps a list of all the current websocket connections.
 * @type {Array}
 */
var clientconnections = [ ]; // list of currently connected clients (users) sockets

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

console.log("\nRunning Spacebrew on PORT "+spacePort);
console.log("More info at http://www.spacebrew.cc");

/**
 * This creates an array of websocket messages to pass in bulk to new Admins
 * in order to catch the Admin up to speed on the current state of the Server.
 * TODO: cache this array of messages, or build it incrementally so we don't have to run
 * this expensive operation every time an Admin connects.
 * @return {Array} An array of messages to catch the new Admin up with the current state
 */
var buildTrustedClientsForAdmin = function(){
    var output = [];
    //re-create the 'name' and 'config' messages
    for(var i = 0, end = trustedClients.length; i < end; i++){
        var currClient = trustedClients[i];
        var currMsg = {name:[{name:currClient.name, remoteAddress:currClient.remoteAddress}]};
        output.push(currMsg);
        var publishers = [];
        var subscribers = [];
        var items = [[publishers, currClient.publishers],[subscribers, currClient.subscribers]];
        for(var j = 0; j < items.length; j++){
            for(var key in items[j][1]){
                for (var type in items[j][1][key]){
                    items[j][0].push({name:key, type:type, default:items[j][1][key][type].default});
                }
            }
        }
        currMsg = {config:{name:currClient.name,
                            remoteAddress:currClient.remoteAddress,
                            description:currClient.description,
                            publish:{messages:publishers},
                            subscribe:{messages:subscribers}}};
        output.push(currMsg);
    }
    //now re-create the 'route' messages
    //we only need to build from one side, so we only look at publishers
    for(var i = 0, end = trustedClients.length; i < end; i++){
        var currClient = trustedClients[i];
        for (var key in currClient.publishers){
            for (var type in currClient.publishers[key]){
                var publisherObj = {clientName:currClient.name,
                                    name:key,
                                    type:type,
                                    remoteAddress:currClient.remoteAddress};
                var publisher = currClient.publishers[key][type];
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
    //console.log("Listening of socket connections");

    var connection = ws;
    clientconnections.push(ws);

    /**
     * We will handle all messages from connections here. This includes
     * admin, config, message, and routing messages for setting up, managing, and communicating
     * via spacebrew. This is the backbone of spacebrew.
     * @param  {obj} message The incoming message from an admin or client
     */
    ws.on('message', function(message) {
        console.log(message);
        var bValidMessage = false;
        if (message) {
            // process WebSocket message
            try{
                var tMsg = JSON.parse(message);
            }catch(err){
                console.log("invalid message");
                return;
            }

            if (tMsg['name']) {
                bValidMessage = handleNameMessage(connection, tMsg);
            } else if (tMsg['config']) {
                bValidMessage = handleConfigMessage(connection, tMsg);
            } else if (tMsg['message']) {
                bValidMessage = routeMessage(connection, tMsg);
            } else if (tMsg['admin']) {
                connection.send(JSON.stringify(buildTrustedClientsForAdmin()));
                adminConnections.push(connection);
                bValidMessage = true;
            } else if (tMsg['route']){
                bValidMessage = handleRouteMessage(tMsg);
            }
            if (bValidMessage){
                console.log("forwarding to admins");
                sendToAdmins(tMsg);
            } else {
                console.log("message marked as invalid, ignoring");
            }
        }
    });

    /**
     * When a websocket connection is closed, we want to cleanup the Client
     * (including all publishers and subscribers) associated with that connection,
     * as well as any routes that Client was involved in. Finally we will remove the
     * Client or Admin from their respective connection list and remove the connection
     * from clientconnections. While a Client is being cleaned up, all route remove messages are sent
     * to the Admins and finally a Client remove message is sent to the Admins.
     * @param  {obj} ws The object containing information about the connection that is being closed
     */
    ws.on('close', function(ws) {
        // close user connection
        console.log("close");
        //console.log(ws);
        var removed = [];
        //remove clients
        //console.log("There are this many clients: "+trustedClients.length);

        for(var i = 0; i < trustedClients.length;){
            //console.log(trustedClients);
            //if (trustedClients[i]['connection'].state === 'closed'){
            if (!trustedClients[i].connection._socket){
                
                //for each publisher
                //for each subscriber to that publisher
                //remove route
                //for each subscriber
                //for each publisher to that subscriber
                //remove route
                var items = [[trustedClients[i].publishers, 'subscribers', 'subscriber', 'publisher'],[trustedClients[i].subscribers, 'publishers', 'publisher', 'subscriber']];
                for (var k = 0; k < items.length; k++){
                    for (var key in items[k][0]){
                        for (var type in items[k][0][key]){
                            var currBase = items[k][0][key][type];
                            while(currBase[items[k][1]].length > 0){
                                var currLeaf = currBase[items[k][1]][0];
                                var messageContent = {type:'remove'};
                                messageContent[items[k][2]] = {clientName:currLeaf.client.name,
                                                                name:currLeaf[items[k][2]].name,
                                                                type:currLeaf[items[k][2]].type,
                                                                remoteAddress:currLeaf.client.remoteAddress};
                                messageContent[items[k][3]] = {clientName:trustedClients[i].name,
                                                                name:currBase.name,
                                                                type:currBase.type,
                                                                remoteAddress:trustedClients[i].remoteAddress};
                                if (handleRouteMessage({route:messageContent})){
                                    sendToAdmins({route:messageContent});
                                }
                            }
                        }
                    }
                }
                removed.push({name:trustedClients[i].name, remoteAddress:trustedClients[i].remoteAddress});
                trustedClients.splice(i, 1);
            } else {
                i++;
            }
        }

        //remove admins
        //console.log("There are admins: "+ adminConnections.length);
        for(var i = 0; i < adminConnections.length;){
            if (adminConnections[i]._socket == null){
                adminConnections.splice(i, 1);
            } else {
                i++;
            }
        }
        //remove connections
        for(var i = 0; i<clientconnections.length;){
            if (clientconnections[i]._socket == null){
                clientconnections.splice(i, 1);
            } else {
                i++;
            }
        }
        //tell the admins about removed clients
        sendToAdmins({remove:removed});

    });
});

/**
 * A helper function to handle routing messages from a publisher to the appropriate subscribers.
 * @param  {ws Connection Obj} connection The connection that the message came in on
 * @param  {json} tMsg The message from the publisher which should be forwarded to its subscribers
 * @return {boolean}      True iff the message comes from a publisher that exists
 */
var routeMessage = function(connection, tMsg){
    var bValidMessage = false;
    //high level thoughts:
    //1) add a pointer from the connection to the client, so it is O(1) to find the 
    //    appropriate client instead of O(n) -- issue, more than one client per connection, 
    //    but at least we could have a list to make the search shorter, not a full O(n).
    //    Those clients could be sorted in a priority queue based on how often they send messages.
    //2) change to [<type>][<pub/sub Name>] to access publishers and subscribers for a client.
    //    This should help speed up searching since the first level will usually be 3 bins max
    //    and then the second level has many branches instead of the first level having all
    //    the branches and the second level having one branch. Keep in mind that we should support
    //    user-defined types beyond String, Boolean, Range. Is it quicker to rely on the hash-map
    //    to quickly find elements or should be implement our own binary search? 
    //    (sounds like we are going too deep) But maybe we could implement a priority queue, publishers
    //    that publish often are more likely to publish.
    
    //console.log("I got sent a message from "+connection);

    //add the remote address for the admins
    tMsg['message'].remoteAddress = connection.upgradeReq.headers.host;

    //ROUTING
    var pub;
    //find the associated client
    //get the appropriate publisher on that client
    //for each subscriber to that publisher,
    //translate the message to the subscriber's name
    //and send the type & value
    for(var i = trustedClients.length - 1; i>= 0; i--){
        var currClient = trustedClients[i];
        if (currClient.name === tMsg.message.clientName
            && currClient.remoteAddress === tMsg.message.remoteAddress){
            pub = currClient.publishers[tMsg.message.name];
            if (!pub){
                console.log("an un-registered publisher name: " + tMsg.message.name);
            } else {
                pub = pub[tMsg.message.type];
                if (!pub){
                    console.log("an un-registered publisher type: " + tMsg.message.type + " with name: " + tMsg.message.name);
                } else {
                    bValidMessage = true;
                    for(var j = pub.subscribers.length - 1; j >= 0; j--){
                        var currSub = pub.subscribers[j];
                        currSub.client.connection.send(JSON.stringify({message:{
                            name:currSub.subscriber.name,
                            type:tMsg.message.type,
                            value:tMsg.message.value
                        }}));
                    }
                }
            }
            break;
        }
    }
    return bValidMessage;
}

/**
 * A helper function to handle adding and removing routes. This will update the neccessary
 * data structures
 * @param  {json} tMsg The message from an Admin specifying whether to add or remove a route
 * @return {boolean}      True iff the route message was valid and changed the state of the server.
 */
var handleRouteMessage = function(tMsg){
    //TODO: check that the message came from an admin?
    //expected message format:
    //{route:{type:<add/remove>,
    //        publisher:{clientName:_____,name:____,type:_____,remoteAddress:_____},
    //        subscriber:{clientName:____,name:____,type:____,remoteAddress:____}}}
    //ignore if types do not match
    var bValidMessage = false;
    var pub = tMsg.route.publisher, sub = tMsg.route.subscriber;
    if (pub.type === sub.type){
        var pubEntry, subEntry, pubClient, subClient;
        //find the appropriate entry in trustedClients
        var tcLength = trustedClients.length;
        for(var i = 0; i < tcLength && (pubEntry === undefined || subEntry === undefined); i++){
            if (trustedClients[i].name === pub.clientName 
                && trustedClients[i].remoteAddress === pub.remoteAddress){
                pubClient = trustedClients[i];
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
                var items = [[subEntry, pubEntry.subscribers, 'subscriber'],[pubEntry, subEntry.publishers, 'publisher']];
                for (var j = 0; j < items.length; j++){
                    var item = items[j];
                    for(var i = item[1].length - 1; i >= 0; i--){
                        entry = item[1][i];
                        if (entry[item[2]] === item[0]){
                            item[1].splice(i, 1);
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
 * A helper function used to parse config messages from Clients.
 * @param  {ws Connection Obj} connection The connection that the message came in on
 * @param  {json} tMsg       The config message from the Client
 * @return {boolean}            True iff the Client you are trying to config does not already exist
 */
var handleConfigMessage = function(connection, tMsg){
    var bValidMessage = false;
    //TODO: support multiple clients per connection
    //first check to see if client exists already
    if (!connection.spacebrew_already_processed){
        //check to see if the name alredy exists, if so, close this connection.
        var numTrusted = trustedClients.length;
        var msgName = tMsg['config']['name'],
            msgAddress = connection.upgradeReq.headers.host;
        while (numTrusted--){
            if (trustedClients[numTrusted]['name'] === msgName &&
                trustedClients[numTrusted]['remoteAddress'] === msgAddress){
                console.log("client is already connected -- denying new connection");
                connection.close();
                return false;
            }
        }
        //it passes muster, lets add it as a trusted client
        connection.spacebrew_already_processed = true;
        //console.log("Logged new connection");
        var tClient = {
            "name": msgName,
            "remoteAddress": msgAddress,
            "description": "",
            "connection": connection,
            "publishers": {},
            "subscribers": {},
            "config":""
        };
        console.log("Client is new");

        trustedClients.push(tClient);
        console.log("client added");
        bValidMessage = true;
        console.log("Here are the current trustedClients "+trustedClients.length);

        for (var i=0; i<trustedClients.length; i++) {
            console.log(trustedClients[i]['name']);
        }
        //and send the config to the admins
        sendToAdmins({name:[{name:msgName, remoteAddress:msgAddress}]});
    }

    // accept each apps config and add it to its respect publisher and subscriber list
    var trustedClient = undefined;
    for(var i = 0; i < trustedClients.length; i++){
        if (trustedClients[i].name === tMsg['config']['name'] &&
            trustedClients[i].remoteAddress === connection.upgradeReq.headers.host){
            trustedClient = trustedClients[i];
            break;
        }
    }

    if (trustedClient !== undefined){
        bValidMessage = true;
        //add the remote address to the message for the admins
        tMsg['config'].remoteAddress = trustedClient.remoteAddress;
        trustedClient.config = tMsg['config'];
        trustedClient.description = tMsg['config']['description'];
        var tSubs = [];
        if (tMsg.config.subscribe && tMsg.config.subscribe.messages){
            tSubs = tMsg.config.subscribe.messages;
        } else {
            tMsg.config['subscribe'] = {};
            tMsg.config.subscribe['messages'] = [];
        }
        var tPubs = [];
        if (tMsg.config.publish && tMsg.config.publish.messages){
            tPubs = tMsg.config.publish.messages;
        } else {
            tMsg.config['publish'] = {};
            tMsg.config.publish['messages'] = [];
        }
        var items = [[tSubs, trustedClient.subscribers,'publishers'], [tPubs, trustedClient.publishers,'subscribers']];
        //we are storing in a structure
        // trustedClient = {subscribers:{<name>:{<type>:{name:____,type:____,publishers:[{client:<client_pointer>,publisher:<pub_pointer>}]}}}
        //                  publishers:{<name>:{<type>:{name:____,type:____,default:____,subscribers:[{client:<client_pointer>,subscriber:<sub_pointer>}]}}}}
        //so you need to access them by trustedClients[i][<sub_or_pub>][<name>][<type>]
        for (var j = 0; j<items.length; j++){
            item = items[j];
            var hash = {};
            //add new subscribers/publishers to hash
            for (var i=0; i<item[0].length; i++) {
                if (!hash[item[0][i].name]){
                    hash[item[0][i].name] = {};
                }
                hash[item[0][i].name][item[0][i].type] = item[0][i];
                if (!item[1][item[0][i].name]){
                    item[1][item[0][i].name] = {};
                }
                if (!item[1][item[0][i].name][item[0][i].type]){
                    item[0][i][item[2]] = [];
                    item[1][item[0][i].name][item[0][i].type] = item[0][i];
                }
            }
            //remove stale subscribers/publishers from hash
            for (var key in item[1]){
                if (hash[key] === undefined){
                    delete item[1][key];
                } else {
                    for (var type in item[1][key]){
                        if (hash[key][type] === undefined){
                            delete item[1][key][type];
                        }
                    }
                }
            }
        }
    }
    return bValidMessage;
}

/**
 * Handles the initial 'name' message from Clients that is used to register them with 
 * the Server. Currently deprecated.
 * @param  {ws Connection Obj} connection The connection that the message came in on
 * @param  {json} tMsg The name message from the Client
 * @return {boolean}      True iff there does not exist a Client with that name
 */
var handleNameMessage = function(connection, tMsg){
    return false;
    //IGNORING FOR NOW, ONLY CONFIG MESSAGES ARE SUPPORTED
    // //a connection is registering themselves
    // //console.log(tMsg['name']);
    // for (var index = 0; index < tMsg['name'].length; index++){
    //     var tVar = [tMsg['name'][index].name, connection.upgradeReq.headers.host, connection];
    //     //add the remote address to the message for the admins
    //     tMsg['name'][index].remoteAddress = connection.upgradeReq.headers.host;

    //     var existingClient = false;
    //     for(var i=0; i<trustedClients.length; i++) {
    //         //console.log("NAMES: "+ trustedClients[i]['name'] +" : "+ tVar[0]);
    //         //console.log("ADDRESS: "+ trustedClients[i]['remoteAddress'] +" : "+ tVar[1]);
    //         if (trustedClients[i]['name'] === tVar[0] && trustedClients[i]['remoteAddress'] === tVar[1]) {
    //             existingClient = true;
    //             console.log("client is already connected -- denying new connection");
    //             connection.close();
    //         }
    //     }
    //     if (existingClient === false) {
    //         //console.log("Logged new connection");
    //         var tClient = {
    //             "name": tVar[0],
    //             "remoteAddress": tVar[1],
    //             "description": "",
    //             "connection": connection,
    //             "publishers": {},
    //             "subscribers": {},
    //             "config":""
    //         };
    //         console.log("Client is new");

    //         trustedClients.push(tClient);
    //         console.log("client added");
    //         bValidMessage = true;
    //     }
    // }

    // console.log("Here are the current trustedClients "+trustedClients.length);

    // for (var i=0; i<trustedClients.length; i++) {
    //     console.log(trustedClients[i]['name']);
    // }
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
