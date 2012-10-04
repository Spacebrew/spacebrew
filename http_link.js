var http = require('http');
var sys = require('sys');
var url = require('url');
var wsc = require('websocket').client;

var port = 9092;
var spacebrewHost = 'localhost';
var spacebrewPort = 9000;
var clients = {};
var TIMEOUT = 12*60*60; // 12 hour timeout
var DEBUG = true

/*
 
Node.js server that accepts pure HTTP requests and pipes the requests through websockets.
The server keeps track of different clients and maintains a websocket connection with spacebrew to pass along future messages.
The main driving force behind this is that electric imp only allows HTTP requests in and out (no websockets), but this generally opens up the capabilities of spacebrew to work with pure HTTP clients.

Next steps:
- Accept configuration message from HTTP client.
- Complete the loop and allow responses to be sent to HTTP client
- Custom client timeout

HTTP request:
currently only tested as a GET request

http://localhost:9092/?value=512&name=imp

name = client name
value = sensor value

 */

// TODO add per-client timeout interval at config time


function dir(object) {
    stuff = [];
    for (s in object) {
        stuff.push(s);
    }
    stuff.sort();
    return stuff;
}

function getSecondsEpoch(){
    var d = new Date();
    var seconds = d.getTime() / 1000;
    return seconds;
}

// TODO handle websocket disconnect

function configureClient(name, value) {
    
    nameObj = {"name" : [ { "name" : name } ] };
    
    // TODO add dynamic config not just "value"
    configObj = {"config" : { "name" : name,
                            "description" : "Pass through http client for electric imp",
                            "publish" : { "messages" : [ { "name" : "value", "type": "range", "default" : "0"} ] },
                            "subscribe" : { "messages" : [] }
                            }
                };
    
    jsonName = JSON.stringify(nameObj);
    sys.puts("jsonName: " + jsonName);

    jsonConfig = JSON.stringify(configObj);
    sys.puts("jsonConfig: " + jsonConfig);
    
    client = new wsc();
    
    client.on("connect", function(conn){
        this.connection = conn;
        this.name = name;
        this.initialValue = value;
        this.lastUpdate = getSecondsEpoch()
        sys.puts("Websocket connected\n");
        
        this.connection.send(jsonName);
        this.connection.send(jsonConfig);
        
        clients[this.name] = this;
        
        processMessage(this.name, this.initValue);
        
        // untested
        this.connection.on("message", function(message) {
            sys.puts("Message: " + this.name + " : received message : " + message + "\n");
        });
    });
    
    // untested
    client.on("message", function(message) {
        sys.puts("Message: " + this.name + " : received message : " + message + "\n");
    });        
        
    var url = "ws://" + spacebrewHost + ":" + String(spacebrewPort);
    sys.puts("url: " + url);
    client.connect(url);
}

function processMessage(name, value) {
    var targetClient = false;

    if( clients.hasOwnProperty(name) ) {
        targetClient = clients[name];
    }
    
    if(targetClient == false) {
        sys.puts("ERROR: Can't find client for " + name + "\n");
        return;
    }
    
    targetClient.lastUpdate = getSecondsEpoch()
    
    msgObj = { "message" : {
                             "clientName" : name,
                             "name" : "value",      // TODO build this out
                             "type" : "range",
                             "value" : value }
              };
              
    jsonMsg = JSON.stringify(msgObj)
    //sys.puts(sys.inspect(targetClient));
    targetClient.connection.send(jsonMsg);
}

var checkTimeouts = function()
{
    //sys.puts("clients are: " + dir(clients))
    
    for (var name in clients) {
        var client = clients[name]
        //sys.puts("client is : " + dir(client.connection))
        if( client.lastUpdate + TIMEOUT < getSecondsEpoch() ) {
            
            client.connection.close()
            delete clients[name]
            client = undefined
            //sys.puts("timedout: " + name)
        }
        
        // TODO check to see if the socket is dead
        
    }
    
    //sys.puts("clients are: " + dir(clients))
}

// check timeout every 5 seconds
setInterval(checkTimeouts, 5 * 1);

http.createServer(function (req, res) {
    
    if(DEBUG) {
        sys.puts("request: " + req.url);
    }
    
    var name = undefined;
    var value = undefined;
    
    if(req.method == "POST") {
        sys.puts("POST type not supported");
        res.end("501");
        return;
    
    } else if(req.method == "GET") {
        
        var vals = url.parse(req.url, true).query;
        name = vals.name;
        value = vals.value;
        
    } else {
        
        sys.puts("UNKNOWN request method of " + req.method);
        res.end("501");
        return;
    
    }
    
    if( name == undefined || value == undefined ) {
        sys.puts("name and value not defined.");
        res.end("500");
    }
    
    // TODO wrap this in a try/catch type block
    
    // string is name=whatever&value=5 ...
    var name = vals.name;
    var value = vals.value;
    
    // TODO check to see if both params are passed and valid
    if( !clients.hasOwnProperty(name) ) {
        sys.puts("Client not found, configuring.");
        configureClient(name, value);
    } else {
        sys.puts("Processing message from: " + name);
        processMessage(name, value);
    }
    
    res.writeHead(200, {"Content-Type": "text/plain"});
    res.end("OK");
    
}).listen(port);

