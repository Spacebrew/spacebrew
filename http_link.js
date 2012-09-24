var http = require('http');
var sys = require('sys');
var url = require('url');
var wsc = require('websocket').client;

var port = 9092;
var spacebrewHost = 'localhost';
var spacebrewPort = 9000;
var clients = {};

// TODO add per-client timeout interval at config time
// TODO handle timeout

function clientHolder(name, connetion) {
    this.name = name;
    this.connection = connection;
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

http.createServer(function (req, res) {
    
    // TODO figure out why we get a blank request
    sys.puts("request: " + sys.inspect(url.parse(req.url, true).query));
    var vals = url.parse(req.url, true).query;
    
    sys.puts(vals);
    if(!vals.hasOwnProperty("name")) {
        sys.puts("Detected blank request.");
        res.writeHead(200, {"Content-Type": "text/plain"});
        res.end("OK");
        return;
    }
    
    var name = vals.name;
    var value = vals.value;
    
    if( !clients.hasOwnProperty(name) ) {
        configureClient(name, value);
    } else {
        processMessage(name, value);
    }
    
    res.writeHead(200, {"Content-Type": "text/plain"});
    res.end("OK");
    
}).listen(port);

