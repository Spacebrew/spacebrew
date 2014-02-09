var http = require('http');
var sys = require('sys');
var url = require('url');
var WebSocketClient = require('ws');

var port = 9092;
var defaultHost = 'localhost';
var defaultPort = 9000;
var clients = {byID:{},byName:{}};
var TIMEOUT = 12*60*60; // 12 hour timeout
var DEBUG = true;
var clientID = 0;
var wsClient = undefined;

/*
 
Node.js server that accepts pure HTTP requests and pipes the requests through websockets.
The server keeps track of different clients and maintains a websocket connection with spacebrew to pass along future messages.

Next steps:
- Custom client timeout
- Use strict json format for all responses
- Probably use error flag in returned json instead of returning HTML error state

HTTP request:
currently only tested as a GET request


CAN TEST WITH:
http://localhost:9092/?config={%22config%22:{%22name%22:%22test%22,%22publish%22:{%22messages%22:[{%22name%22:%22output%22,%22type%22:%22string%22},{%22name%22:%22out%22,%22type%22:%22string%22}]},%22subscribe%22:{%22messages%22:[{%22name%22:%22input%22,%22type%22:%22string%22,%22bufferSize%22:3}]}}}
http://localhost:9092/?clientID=0&poll=true
http://localhost:9092/?clientID=0&publish=[{%22message%22:{%22clientName%22:%22test%22,%22name%22:%22output%22,%22type%22:%22string%22,%22value%22:%22hello!%22}}]
 */

// TODO add per-client timeout interval at config time

/**
 * Lists all the attributes for the provided object.
 * This is provided to parallel Python's dir function. Results are
 * alphabetically sorted
 * @param  {object} object The object to inspect
 * @return {array}        A sorted list of attributes
 */
function dir(object) {
    var stuff = Object.keys(object);
    stuff.sort();
    return stuff;
}

/**
 * Returns the number of seconds since the Unix epoch.
 * @return {Number} The number of seconds since the Unix epoch
 */
function getSecondsEpoch(){
    var d = new Date();
    var seconds = d.getTime() / 1000;
    return seconds;
}

/**
 * Sends the provided client's configuration to the SB server.
 * This function will also create some data structures for queuing messages for
 * the client.
 * @param  {json} clientData The data storing all info related to this client
 * @param  {json} output The json object returned in the response
 */
function configureClient(clientData, output) {

    //TODO: document how client can specify buffer size
    //TODO: allow client to specify timeout
    if (!clientData.received){
        clientData.received = {};
    }
    var subscribers = clientData.config.config.subscribe.messages;

    //first remove any buffers that don't match current client definition
    for (var type in clientData.received){
        for(var name in clientData.received[type]){
            var found = false
            for(var index in subscribers){
                if (subscribers[index].type == type && subscribers[index].name == name){
                    found = true;
                    break;
                }
            }
            if (!found){
                delete clientData.received[type][name];
            }
        }
        if (Object.keys(clientData.received[type]).length == 0){
            delete clientData.received[type];
        }
    }

    //the add new buffers to match current client definition
    for (var i = subscribers.length - 1; i >= 0; i--) {
        var sub = subscribers[i];
        //copying ROOT -> type -> name -> DATA multi-level map from the server 
        //(see handleMessageMessage in spacebrew.js)
        if (!clientData.received[sub.type]){
            clientData.received[sub.type] = {};
        }
        if (!clientData.received[sub.type][sub.name]){
            //this will be an array to act as a buffer
            clientData.received[sub.type][sub.name] = {bufferSize:sub.bufferSize || 1, buffer:[]};
            if (sub.bufferSize){
                delete sub.bufferSize;
            }
        }
    }

    //send config to SB server
    jsonConfig = JSON.stringify(clientData.config);
    sys.puts("jsonConfig: " + jsonConfig);

    //TODO: check if ws is connected
    try{
        wsClient.send(jsonConfig);
    }
    catch (error){
        output.error = true;
        output.messages.push("error while sending config: " + error.name + " msg: " + error.message);
    }
}

var checkTimeouts = function()
{
    
    for (var name in clients) {
        var client = clients[name]
        if( client.lastUpdate + TIMEOUT < getSecondsEpoch() ) {
            
            client.connection.close()
            delete clients[name]
            client = undefined
        }
        
        // TODO check to see if the socket is dead
        
    }

}

/**
 * Called when we receive a message from the Server.
 * @param  {websocket message} data The websocket message from the Server
 */
var receivedMessage = function(data, flags){
    // console.log(data);
    if (data){
        var json = JSON.parse(data);
        //TODO: check if json is an array, otherwise use it as solo message
        //when we hit a malformed message, output a warning
        if (!handleMessage(json)){
            for(var i = 0, end = json.length; i < end; i++){
                handleMessage(json[i]);
            }
        }
    }
};

/**
 * Handle the json data from the Server and forward it to the appropriate function
 * @param  {json} json The message sent from the Server
 * @return {boolean}      True iff the message was a recognized type
 */
var handleMessage = function(json){
    if (json.message){
        var clientData = clients.byName[json.message.clientName];
        if (clientData){
            var nameMap = clientData.received[json.message.type];
            if (nameMap){
                var bufferObj = nameMap[json.message.name];
                if (bufferObj){
                    bufferObj.buffer.push(json);
                    if (bufferObj.buffer.length > bufferObj.bufferSize){
                        bufferObj.buffer.splice(0,1);
                    }
                }
            }
        }
    } else if (json.admin){
    } else if (json.config){
    } else if (json.route){
    } else if (json.remove){
    } else {
        return false;
    }
    return true;
};

var setupWSClient = function(){ 
    // create the wsclient and register as an admin
    wsClient = new WebSocketClient("ws://"+defaultHost+":"+defaultPort);
    wsClient.on("open", function(conn){
        console.log("connected");
    });
    wsClient.on("message", receivedMessage);
    // TODO handle websocket disconnect
    wsClient.on("error", function(){console.log("ERROR"); console.log(arguments);});
    wsClient.on("close", function(){console.log("CLOSE"); console.log(arguments);});
}

//TODO: set up timer to attempt connection if it doesn't happen
setupWSClient();

// check timeout every 5 seconds
setInterval(checkTimeouts, 5 * 1);

//the server listens for GET requests passing the data via query string
//the following query string values are accepted/expected
//config=<CONFIG_JSON>
//   This is required the first time a client registers. The <CONFIG_JSON> 
//  should be the full stringified JSON that you would normally send via 
//  websocket to the server. (ie. config={config:{name:.......}})
//   In response to initially registering a client, this server will send back
//  a unique identifier used to identify your client in the future.
//   You can also send this config value again along with the 
//  CLIENT_ID (see below) if you need to send a client update.
//clientID:<CLIENT_ID>
//   This should be used any time after first registering the client. The 
//  <CLIENT_ID> is the unique identifier returned in the GET response that
//  first registers a client with this server.
//poll:<true|false>
//   if true, then the server will provide any stored data for all of the
//  subscribers this client has registered.
//publish:<PUB_JSON>
//   json stipulating values to send out via this client's registered 
//  publishers. The format of <PUB_JSON> is an array of publish messages
//  where each publish message is formatted as expected by the Spacebrew server
//  (ie. [<PUB_DATA>\[,<PUB_DATA>....\]] where <PUB_DATA> is 
//  {name:<PUB_NAME>,clientName:<CLIENT_NAME>,type:<PUB_TYPE>,
//  value:<PUB_VALUE>:<PUB_VALUE>}

http.createServer(function (req, res) {
    
    if(DEBUG) {
        sys.puts("request: " + req.url);
    }
    
    var config = undefined;
    var id = undefined;
    var publish = undefined;
    var poll = undefined;
    var output = {error:false,messages:[]};
    res.setHeader('Content-Type', 'application/json');
    
    if(req.method == "GET") {
        
        var vals = url.parse(req.url, true).query;
        config = vals.config;
        if (config){
            try{
                config = JSON.parse(config);
            }
            catch (error){
                output.error = true;
                output.messages.push("error parsing config: "+error.name+" msg: "+error.message);
                config = undefined;
            }
        }
        id = vals.clientID;
        poll = vals.poll;
        if (poll){
            poll = poll.toLowerCase() == "true";
        }
        publish = vals.publish;
        if (publish){
            try{
                publish = JSON.parse(publish);
            }
            catch (error){
                output.error = true;
                output.messages.push("error parsing publish: "+error.name+" msg: "+error.message);
                publish = undefined;
            }
        }
        
    } else {//"DELETE" "PUT" "POST"...
        /*
        So There is a big discussion here about which HTTP verbs handle which commands.
        The suggestions of REST are that POST is non-idempotent (multiple calls can change server state)
        however all other verbs are idempotent. Since most methods change the state of the server, it seems
        like we should be using POST almost exclusively, but using GET is so easy... and this isn't a "real" HTTP server...
         */
        output.error = true;
        output.messages.push("unsupported request method of " + req.method);
    }

    //TODO: method
    if (id != undefined){
        var clientData = clients.byID[id];
        if (!clientData){
            output.error = true;
            output.messages.push("id does not match any registered clients");
        } else if (config){
            //possibly a client config update
            if (!config.config){
                output.error = true;
                output.messages.push("invalid config format");
            } else if (config.config.name != clientData.config.config.name){
                output.error = true;
                output.messages.push("supplied client name does not match registered client name");
            } else {
                //I believe this is updating both byID and byName
                clientData.config = config;
                configureClient(clientData, output);
            }
        }
        if (!output.error){
            if (publish){
                try{
                    for (var i = 0; i < publish.length; i++) {
                        wsClient.send(JSON.stringify(publish[i]));
                    }
                }
                catch(error){
                    output.error = true;
                    output.messages.push("error parsing published values: " + error.name + " msg: " + error.message);
                }
            }
            if (poll){
                //return stored values
                var messages = [];
                for(var type in clientData.received){
                    var nameMap = clientData.received[type];
                    for (var name in nameMap){
                        var bufferObj = nameMap[name];
                        if (bufferObj && bufferObj.buffer.length > 0){
                            messages = messages.concat(bufferObj.buffer);
                            bufferObj.buffer = [];
                        }
                    }
                }
                output.received = messages
            }
        }
    } else if (config){
        if (!config.config){
            output.error = true;
            output.messages.push("config must contain a 'config' object");
        } else {
            if (!config.config.name){
                output.error = true;
                output.messages.push("config requires a client 'name'");
            } else if (clients.byName[config.config.name]){
                output.error = true;
                output.messages.push("client with provided name already registered with this http_link");
            } else {
                //valid (perhaps) config
                var clientData = {"config":config};
                configureClient(clientData, output);
                if (!err){
                    clients.byID[clientID] = clientData;
                    clients.byName[config.config.name] = clientData;
                    id = clientID;
                    clientID++;
                }
            }
        }
    } else {
        output.error = true;
        output.messages.push("send client config or reference registered client by id");
    }
    output.clientID = id;
    res.end(JSON.stringify(output));
    
}).listen(port);

