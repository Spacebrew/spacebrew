var http = require('http');
var sys = require('sys');
var url = require('url');

try {

    var WebSocket = require('websocket');
    var wsc = WebSocket.client;

    var Jog = require('jog')
    var log = new Jog(new Jog.FileStore('brew-logs/http_link.log'))
    
} catch ( err ) {
    sys.puts("ERROR: Require exception [" + err + "], did you install dependencies?");
    process.exit(1);
}

var port = 9092;
var spacebrewHost = 'localhost';
var spacebrewPort = 9000;
var clients = {};
var TIMEOUT = 12*60*60; // 12 hour timeout
var TIMEOUT_TEST_INVERVAL = 60; // check every minute

var tailLog = true; // should we tail the log into console or not?  Note at beginning log is dumped to console.


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
    log.debug("structure", {jsonName: jsonName, client: name} );

    jsonConfig = JSON.stringify(configObj);
    log.debug("structure", {jsonConfig: jsonConfig, client: name} );
    
    client = new wsc();
    
    client.on("connect", function(conn){
        this.connection = conn;
        this.name = name;
        this.initialValue = value;
        this.lastUpdate = getSecondsEpoch()
        
        log.debug("event", {msg: "Websocket connected.", client: name} );
        
        this.connection.send(jsonName);
        this.connection.send(jsonConfig);
        
        clients[this.name] = this;
        
        processMessage(this.name, this.initValue);
        
        // untested.  in or out of connection?
        this.connection.on("message", function(message) {
            log.debug("message", {func: "connection.on", message: message, client: this.name} );
        });
    });
    
    // untested
    client.on("message", function(message) {
        log.debug("message", {func: "client.on", message: message, client: this.name} );
    });        
        
    var url = "ws://" + spacebrewHost + ":" + String(spacebrewPort);
    log.debug("url", {func: "configureClient", url : url} );
    client.connect(url);
    
    log.info("msg", {msg: 'Configured client.', name: this.name, value: value, timeout: TIMEOUT} );
}

function processMessage(name, value) {
    var targetClient = false;

    if( clients.hasOwnProperty(name) ) {
        targetClient = clients[name];
    }
    
    if(targetClient == false) {
        sys.warn("ERROR: Can't find client for " + name + "\n");
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
    
    log.debug("msg", {msg: 'Processed value.', client: this.name, value: value} );
}

var checkTimeouts = function()
{
    log.debug("msg", {msg: "Checking Timeouts.", clients: dir(clients)} );
    
    for (var name in clients) {
        var client = clients[name]
        if( client.lastUpdate + TIMEOUT < getSecondsEpoch() ) {
            
            client.connection.close()
            delete clients[name]
            client = undefined
            log.info("timeout", {msg: 'client timeout. ', client: name} );
        }
        
        // TODO check to see if the socket is dead
        
    }
}

setInterval(checkTimeouts, TIMEOUT_TEST_INVERVAL * 1000);

http.createServer(function (req, res) {
    
    log.debug("msg", {msg: "Serving Request.", request: req.url} );
    
    var name = undefined;
    var value = undefined;
    
    if(req.method == "POST") {
        log.warn("unsupported", {msg: "POST type not supported", request: req.url} );
        res.end("501");
        return;
    
    } else if(req.method == "GET") {
        
        var vals = url.parse(req.url, true).query;
        name = vals.name;
        value = vals.value;
        
    } else {
        
        log.error("unexpected", {msg : "UNKNOWN request method.", request: req.url, method: request.method} );
        res.end("501");
        return;
    
    }
    
    if( name == undefined || value == undefined ) {
        log.debug("msg", {msg: "name and value not defined.", request: req.url} );
        res.end("500");
        return;
    }
    
    // TODO wrap this in a try/catch type block
    
    // string is name=whatever&value=5 ...
    var name = vals.name;
    var value = vals.value;
    
    // TODO check to see if both params are passed and valid
    if( !clients.hasOwnProperty(name) ) {
        log.debug( "msg", {msg: "Client not found, configuring.", client: name} );
        configureClient(name, value);
    } else {
        log.debug( "msg", {msg: "Processing message. ", client: name} );
        processMessage(name, value);
    }
    
    res.writeHead(200, {"Content-Type": "text/plain"});
    res.end("OK");
    
}).listen(port);

log.info( "msg", {msg: "HTTP_LINK has started."} );

log.stream({ end: false, interval: 500 })
  .on('data', function(line) {
    console.log(line);
    }
);