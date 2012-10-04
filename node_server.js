var spacePort = 9000;
if (process.argv[2]) {
    spacePort = process.argv[2];    
} 

var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({port: spacePort});
var http = require('http');

var clientconnections = [ ]; // list of currently connected clients (users) sockets
var trustedClients = []; // list of clients that have sent names
var adminConnections = [];

console.log("\nRunning Spacebrew on PORT "+spacePort);
console.log("More info at http://www.spacebrew.cc");

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
wss.on('connection', function(ws) {
    
    var connection = ws;
    clientconnections.push(ws);

    // This is the most important callback for us, we'll handle
    // all messages from users here.
    ws.on('message', function(message) {
        console.log(message);
        var bValidMessage = false;
        if (message) {
            // process WebSocket message
            var tMsg = JSON.parse(message);

            if (tMsg['name']) {
                //a connection is registering themselves
                //console.log(tMsg['name']);
                for (var index = 0; index < tMsg['name'].length; index++){
                    var tVar = [tMsg['name'][index].name, connection.upgradeReq.headers.host, connection];
                    //add the remote address to the message for the admins
                    tMsg['name'][index].remoteAddress = connection.upgradeReq.headers.host;

                    var existingClient = false;
                    for(var i=0; i<trustedClients.length; i++) {
                        //console.log("NAMES: "+ trustedClients[i]['name'] +" : "+ tVar[0]);
                        //console.log("ADDRESS: "+ trustedClients[i]['remoteAddress'] +" : "+ tVar[1]);
                        if (trustedClients[i]['name'] === tVar[0] && trustedClients[i]['remoteAddress'] === tVar[1]) {
                            existingClient = true;
                            console.log("client is already connected");
                        }
                    }
                    if (existingClient === false) {
                        //console.log("Logged new connection");
                        var tClient = {
                            "name": tVar[0],
                            "remoteAddress": tVar[1],
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
                    }
                }

                console.log("Here are the current trustedClients "+trustedClients.length);

                for (var i=0; i<trustedClients.length; i++) {
                    console.log(trustedClients[i]['name']);
                }
            } else if (tMsg['config']) {
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
            } else if (tMsg['message']) {
                //console.log("I got sent a message from "+connection);

                // BROADCAST
                // var messageToSend = JSON.stringify(tMsg);
                // for (var j=0, end=trustedClients.length; j<end; j++) {
                //     trustedClients[j].connection.sendUTF(messageToSend);
                // }
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
            } else if (tMsg['admin']) {
                connection.send(JSON.stringify(buildTrustedClientsForAdmin()));
                adminConnections.push(connection);
                bValidMessage = true;
            } else if (tMsg['route']){
                bValidMessage = handleRouteMessage(tMsg);
            }
            if (bValidMessage){
                sendToAdmins(tMsg);
            }
        }
    });

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

var handleRouteMessage = function(tMsg){
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
            bValidMessage = true;
            if (tMsg.route.type == "add"){
                pubEntry.subscribers.push({client:subClient,subscriber:subEntry});
                subEntry.publishers.push({client:pubClient,publisher:pubEntry});
            } else if (tMsg.route.type == "remove"){
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
}

var sendToAdmins = function(json){
    for(var i = adminConnections.length - 1; i >= 0; i--){
        adminConnections[i].send(JSON.stringify(json));
    }
}