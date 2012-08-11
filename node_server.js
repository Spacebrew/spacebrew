var WebSocketServer = require('websocket').server;
var http = require('http');

var clientconnections = [ ]; // list of currently connected clients (users) sockets
var clients = [ ]; // list of socket and name pairings
var clientObjs = [ ];
var subscribers = [ ]; 
var publishers = [ ];
var routes = [ ];
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

    var repeatConnection = false;
    console.log("Going to check "+clientconnections.length+" connections.");
    for (var i=0; i<clientconnections.length; i++) {
        console.log(clientconnections[i]);
        console.log(connection);
        if (clientconnections[i] === connection) {
             repeatConnection = true; // flag if it exists
             console.log("rejected existing user, already connected");

        }
    }
    if (repeatConnection === false) {
        var index = clientconnections.push(connection) - 1;
        //console.log("Logged new connection");
        var tClient = {
            "name": "",
            "id": "",
            "description": "",
            "connection": "",
            "publishers": "",
            "subscribers": ""
        };
        tClient['connection'] = connection;
        tClient['id'] = index;
        console.log("Client is new");
    }

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
                var tVar = [tMsg['name'][0].name, connection['remoteAddress']];

                var existingClient = false;
                for(var i=0; i<clients.length; i++) {
                    if (clients[i][0] === tVar[0]) {
                        existingClient = true;
                        console.log("client is already connected");
                    }
                }
                if (existingClient === false) {
                    clients.push(tVar);
                    console.log("client added");
                    //console.log(tVar+" : "+index);
                }

                console.log("Here are the current clients "+clients.length);

                for (var i=0; i<clients.length; i++) {
                    console.log(clients[i][0]);
                }
            }

            if (tMsg['admin']) {
                console.log(clients);
                //var json = JSON.stringify({ name:clients, data: clients });
                clientconnections[index].sendUTF(JSON.stringify(clients));
                adminExists = true;
                adminConnection = connection;
            }

            if (adminExists) {
                adminConnection.sendUTF(JSON.stringify(clients));
            }

            if (tMsg['config']) {
                // accept each apps config and add it to its respect publisher and subscriber list
                //console.log(tMsg);

                // now parse and look for subscribers and publishers
                var tSubs = tMsg['config']['subscribe']['messages'];
                for (var i=0; i<tSubs.length; i++) {
                    //console.log(tSubs[i]['name']);

                }
                //console.log("My subs are "+tSubs);

                //var json = JSON.stringify({ type:'message', data: message });
                //clientconnections[index].sendUTF(JSON.stringify(clients));
            }

            // if route exists 0->1, 2->0, 1->1  
            // { "hello": ["helloagain", ]
            var web0 = new Array(0, 1, 2);
            var web1 = new Array(0, 1);
            // web1[0] = 1;
            var web2 = new Array(2, 1);
            routes.push(web0);
            routes.push(web1);
            routes.push(web2);
            //console.log(routes);

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

    connection.on('open', function(connection) {
        console.log("open");
    });

    connection.on('close', function(connection) {
        // close user connection
        console.log("close");
    });
});