var WebSocketServer = require('websocket').server;
var http = require('http');

var clientconnections = [ ]; // list of currently connected clients (users) sockets
var clients = [ ]; // list of socket and name pairings
var subscribers = [ ]; 
var publishers = [ ];
var routes = [ ];

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
    var index = clientconnections.push(connection) - 1;

    //console.log(connection);
    // This is the most important callback for us, we'll handle
    // all messages from users here.
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            // process WebSocket message
            console.log(message);
            //console.log(message.utf8Data.name);
            //console.log(JSON.parse(message.utf8Data));
            var tMsg = JSON.parse(message.utf8Data);
            //console.log(tMsg);

            // console.log(tMsg);

            if (tMsg['name']) {
                console.log("I got sent a name");
                console.log(tMsg);
                console.log ("your name will be "+tMsg['name'][0].name);
                var tVar = [tMsg['name'][0].name, index];
                clients.push(tVar);
                console.log(clients);
            }

            if (tMsg['admin']) {
                //var json = JSON.stringify({ type:'message', data: message });
                clientconnections[index].sendUTF(JSON.stringify(clients));
            }

            if (tMsg['config']) {
                // accept each apps config and add it to its respect publisher and subscriber list
                
                //var json = JSON.stringify({ type:'message', data: message });
                //clientconnections[index].sendUTF(JSON.stringify(clients));
            }

            if (tMsg['message']) {
                console.log("I got sent a message");
                var json = JSON.stringify({ type:'message', data: message });
                for (var i=0; i < clientconnections.length; i++) {
                    clientconnections[i].sendUTF(json);
                }
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