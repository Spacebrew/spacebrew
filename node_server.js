var WebSocketServer = require('websocket').server;
var http = require('http');

var clientconnections = [ ]; // list of currently connected clients (users) sockets
var trustedClients = []; // list of clients that have sent names
var adminExists = false;
var adminConnection;

var server = http.createServer(function(request, response) {
    // process HTTP request. Since we're writing just WebSockets server
    // we don't have to implement anything.
});
server.listen(9000, function() { });

// create the server
wsServer = new WebSocketServer({
    httpServer: server
});

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
        if (message.type === 'utf8') {
            // process WebSocket message
            //console.log(message);
            //console.log(message.utf8Data.name);
            //console.log(JSON.parse(message.utf8Data));
            var tMsg = JSON.parse(message.utf8Data);
            //console.log(tMsg);

            // console.log(tMsg);

            if (tMsg['name']) {
                // console.log("I got sent a name");
                // console.log(tMsg);
                // console.log ("your name will be "+tMsg['name'][0].name);
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
                }

                console.log("Here are the current trustedClients "+trustedClients.length);

                for (var i=0; i<trustedClients.length; i++) {
                    console.log(trustedClients[i]['name']);
                }
            }

            if (tMsg['admin']) {
                console.log(trustedClients);
                //var json = JSON.stringify({ name:trustedClients, data: trustedClients });
                clientconnections[index].sendUTF(JSON.stringify(trustedClients));
                adminExists = true;
                adminConnection = connection;
            }

            if (adminExists) {
                adminConnection.sendUTF(JSON.stringify(trustedClients));
            }

            if (tMsg['config']) {
                // accept each apps config and add it to its respect publisher and subscriber list
                //console.log(tMsg);
                var trustedClient = undefined;
                for(var i = 0; i < trustedClients.length; i++){
                    if (trustedClients[i].name === tMsg['config']['name'] &&
                        trustedClients[i].remoteAddress === connection.remoteAddress){
                        trustedClient = trustedClients[i];
                        break;
                    }
                }

                if (trustedClient !== undefined){
                    trustedClient.config = tMsg['config'];
                    // now parse and look for subscribers and publishers
                    var tSubs = tMsg['config']['subscribe']['messages'];
                    var tPubs = tMsg['config']['publish']['messages'];
                    //add new subscribers to hash
                    var items = [[tSubs, trustedClient.subscribers,'publishers'], [tPubs, trustedClient.publishers,'subscribers']];
                    for (var j = 0; j<items.length; j++){
                        item = items[j];
                        var hash = {};
                        for (var i=0; i<item[0].length; i++) {
                            hash[item[0][i].name] = item[0][i];
                            if (!item[1][item[0][i].name]){
                                item[0][i][item[2]] = [];
                                item[1][item[0][i].name] = item[0][i];
                            }
                        }
                        //remove non-defined subscribers from hash
                        for (var key in item[1]){
                            if (hash[key] === undefined){
                                delete item[1][key];
                            }
                        }
                    }
                }
                //console.log("My subs are "+tSubs);

                //var json = JSON.stringify({ type:'message', data: message });
                //clientconnections[index].sendUTF(JSON.stringify(trustedClients));
            }

            // if route exists 0->1, 2->0, 1->1  
            // { "hello": ["helloagain", ]
            var web0 = new Array(0, 1, 2);
            var web1 = new Array(0, 1);
            // web1[0] = 1;
            var web2 = new Array(2, 1);
            // if message comes in from _ then check routes and send along if applicable, otherwise ignore
            // 
            if (tMsg['message']) {
                console.log("I got sent a message from "+connection);
                //console.log(clientconnections.length);

                // SEND TO EVERYONE
                var json = JSON.stringify({ type:'message', data: message });
                for (var j=0; j<clientconnections.length; j++) {
                    clientconnections[j].sendUTF(json);
                }

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
        for(var i = 0; i<clientconnections.length; i++){
            if (clientconnections[i].state === 'closed'){
                clientconnections.splice(i, 1);
            }
        }
    });
});