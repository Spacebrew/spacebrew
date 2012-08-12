var WebSocketServer = require('websocket').server;
var http = require('http');

var clientconnections = [ ]; // list of currently connected clients (users) sockets
var trustedClients = []; // list of clients that have sent names
var adminConnections = [];

var server = http.createServer(function(request, response) {
    // process HTTP request. Since we're writing just WebSockets server
    // we don't have to implement anything.
});
server.listen(9000, function() { });

// create the server
wsServer = new WebSocketServer({
    httpServer: server
});

var buildTrustedClientsForAdmin = function(){
    var output = [];
    for(var i = 0, end = trustedClients.length; i < end; i++){
        var keys = ['name','remoteAddress','description'];
        var currClient = {};
        for(var j = 0; j < keys.length; j++){
            currClient[keys[j]] = trustedClients[i][keys[j]];
        }
        currClient.publishers = [];
        currClient.subscribers = [];
        var toSimplify = [[currClient.publishers, trustedClients[i].publishers, "subscribers", "subscriber"],
                            [currClient.subscribers, trustedClients[i].subscribers, "publishers", "publisher"]];
        for(var entry in toSimplify){
            for(var key in entry[1]){
                for(var type in entry[1][key]){
                    var toAdd = {name:key,type:type};
                    toAdd[entry[2]] = [];
                    for(var j = 0; j < entry[1][key][type][entry[2]].length; j++){
                        var item = entry[1][key][type][entry[2]][j];
                        toAdd[entry[2]].push({clientName:item.client.name,remoteAddress:item.client.remoteAddress,name:item[entry[3]].name});
                    }
                    entry[0].push(toAdd);
                }
            }
        }
        output.push(currClient);
    }
    return output;
}

// WebSocket server
wsServer.on('request', function(request) {
    
    var connection = request.accept(null, request.origin);
    //console.log(tClient);

    // var repeatConnection = false;
    // console.log("Going to check "+clientconnections.length+" connections.");
    // for (var i=0; i<clientconnections.length; i++) {
    //     // console.log(clientconnections[i]);
    //     // console.log(connection);
    //     if (clientconnections[i] === connection) {
    //          repeatConnection = true; // flag if it exists
    //          console.log("rejected existing user, already connected");

    //     }
    // }
    //if (repeatConnection === false) {
        clientconnections.push(connection);
    //}

    //console.log(connection);
    // This is the most important callback for us, we'll handle
    // all messages from users here.
    connection.on('message', function(message) {
        var bValidMessage = false;
        if (message.type === 'utf8') {
            // process WebSocket message
            //console.log(message);
            //console.log(message.utf8Data.name);
            //console.log(JSON.parse(message.utf8Data));
            var tMsg = JSON.parse(message.utf8Data);
            //console.log(tMsg);

            // console.log(tMsg);

            if (tMsg['name']) {
                //a connection is registering themselves
                var tVar = [tMsg['name'][0].name, connection['remoteAddress'], connection];

                var existingClient = false;
                for(var i=0; i<trustedClients.length; i++) {
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

                console.log("Here are the current trustedClients "+trustedClients.length);

                for (var i=0; i<trustedClients.length; i++) {
                    console.log(trustedClients[i]['name']);
                }
            } else if (tMsg['config']) {
                // accept each apps config and add it to its respect publisher and subscriber list
                var trustedClient = undefined;
                for(var i = 0; i < trustedClients.length; i++){
                    if (trustedClients[i].name === tMsg['config']['name'] &&
                        trustedClients[i].remoteAddress === connection.remoteAddress){
                        trustedClient = trustedClients[i];
                        break;
                    }
                }

                if (trustedClient !== undefined){
                    bValidMessage = true;
                    trustedClient.config = tMsg['config'];
                    var tSubs = (tMsg['config']['subscribe'] ? tMsg['config']['subscribe']['messages'] : []);
                    var tPubs = (tMsg['config']['publish'] ? tMsg['config']['publish']['messages'] : []);
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
                console.log("I got sent a message from "+connection);

                // SEND TO EVERYONE
                var json = JSON.stringify({ type:'message', data: tMsg });
                for (var j=0, end=trustedClients.length; j<end; j++) {
                    trustedClients[j].connection.sendUTF(json);
                }
                bValidMessage = true;

                // TRY ROUTING
                // for (var i=0; i<clientconnections.length; i++){
                //     if (clientconnections[i] === connection) {
                //         // console.log(i);
                //         console.log("I am "+i+" and I'm sending to "+routes[i]);
                //         for (var j=0; j<routes[i].length; j++) {
                //             var json = JSON.stringify({ type:'message', data: message });
                //            //     for (var i=0; i < clientconnections.length; i++) {
                //             // console.log("Sending to ")
                //             clientconnections[j].sendUTF(json);
                //             //    }
                //         }
                //     }
                // }

            } else if (tMsg['admin']) {
                connection.sendUTF(JSON.stringify(buildTrustedClientsForAdmin()));
                adminConnections.push(connection);
                bValidMessage = true;
            } else if (tMsg['route']){
                //expected message format:
                //{route:{publisher:{clientName:_____,name:____,type:_____,remoteAddress:_____},
                //        subscriber:{clientName:____,name:____,type:____,remoteAddress:____}}}
                //ignore if types do not match
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
                    //if we have found a matching publisher and subscriber, point them at eachother
                    //then tell the admins about it
                    if (pubEntry && subEntry){
                        pubEntry.subscribers.push({client:subClient,subscriber:subEntry});
                        subEntry.publishers.push({client:pubClient,publisher:pubEntry});
                        bValidMessage = true;
                    }
                }
            }
            if (bValidMessage){
                sendToAdmins(tMsg);
            }
        }
    });

    connection.on('close', function(connection) {
        // close user connection
        console.log("close");
        for(var i = 0; i < trustedClients.length; i++){
            if (trustedClients[i]['connection'].state === 'closed'){
                trustedClients.splice(i, 1);
            }
        }
        for(var i = 0; i < adminConnections.length; i++){
            if (adminConnections[i].state === 'closed'){
                adminConnections.splice(i, 1);
            }
        }
        for(var i = 0; i<clientconnections.length; i++){
            if (clientconnections[i].state === 'closed'){
                clientconnections.splice(i, 1);
            }
        }
    });
});

var sendToAdmins = function(json){
    for(var i = adminConnections.length - 1; i >= 0; i--){
        adminConnections[i].sendUTF(JSON.stringify(json));
    }
}