var http = require("http");
var sys = require("sys");
var url = require("url");
var WebSocketClient = require("ws");

var port = 9092;
var defaultHost = "localhost";
var defaultPort = 9000;
var clients = {byID:{},byName:{}};
var DEFAULT_TIMEOUT = 5*60; // 5 minutes
var DEBUG = true;
var clientID = 0;
var wsClient;

/*
 
Node.js server that accepts pure HTTP requests and pipes the requests through websockets.
The server keeps track of different clients and maintains a websocket connection with spacebrew to pass along future messages.

HTTP request:
currently only tested as a GET request

CAN TEST WITH:
http://localhost:9092/?config={%22config%22:{%22name%22:%22test%22,%22publish%22:{%22messages%22:[{%22name%22:%22output%22,%22type%22:%22string%22},{%22name%22:%22out%22,%22type%22:%22string%22}]},%22subscribe%22:{%22messages%22:[{%22name%22:%22input%22,%22type%22:%22string%22,%22bufferSize%22:3}]}}}
http://localhost:9092/?clientID=0&poll=true
http://localhost:9092/?clientID=0&publish=[{%22message%22:{%22clientName%22:%22test%22,%22name%22:%22output%22,%22type%22:%22string%22,%22value%22:%22hello!%22}}]
 */


/**
 * Returns the number of seconds since the Unix epoch.
 * @return {Number} The number of seconds since the Unix epoch
 */
var getSecondsEpoch = function() {
    var d = new Date();
    var seconds = d.getTime() / 1000;
    return seconds;
};

/**
 * Sends the provided client's configuration to the SB server.
 * This function will also create some data structures for queuing messages for
 * the client.
 * @param  {json} clientData The data storing all info related to this client
 * @param  {json} output The json object returned in the response
 */
var configureClient = function(clientData, output) {

    if (!clientData.received){
        clientData.received = {};
    }
    var subscribers = clientData.config.config.subscribe.messages;

    //first remove any buffers that don't match current client definition
    for (var type in clientData.received){
        for(var name in clientData.received[type]){
            var found = false;
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
        if (Object.keys(clientData.received[type]).length === 0){
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
            //TODO: ensure bufferSize is an integer
            clientData.received[sub.type][sub.name] = {bufferSize:sub.bufferSize || 1, buffer:[]};
            if (sub.bufferSize){
                delete sub.bufferSize;
            }
        }
    }

    //send config to SB server
    var jsonConfig = JSON.stringify(clientData.config);
    if (DEBUG){
        sys.puts("jsonConfig: " + jsonConfig);
    }

    //TODO: check if ws is connected
    try{
        wsClient.send(jsonConfig);
    }
    catch (error){
        output.error = true;
        output.messages.push("Error while sending config: " + error.name + " msg: " + error.message);
    }
};

/**
 * Handle the json data from the Server and forward it to the appropriate function
 * @param  {json} json The message sent from the Server
 * @return {boolean}      True iff the message was a recognized type
 */
var handleMessage = function(json) {
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

/**
 * Called when we receive a message from the Server.
 * @param  {websocket message} data The websocket message from the Server
 */
var receivedMessage = function(data, flags) {
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
 * Creates the websocket client which is used to communicate with the SB server.
 */
var setupWSClient = function() {
    // create the wsclient
    wsClient = new WebSocketClient("ws://"+defaultHost+":"+defaultPort);
    wsClient.on("open", function(conn){
        //TODO: re-send client configs if this is a re-connect (or generally if there are configs)
        console.log("connected");
    });
    wsClient.on("message", receivedMessage);

    wsClient.on("error", function(){
        console.log("ERROR");
        if (DEBUG){
            console.log(arguments);
        }
        //attempt re-connect after 5 seconds
        setTimeout(setupWSClient, 5000);
    });

    wsClient.on("close", function(){
        console.log("CLOSE");
        if (DEBUG){
            console.log(arguments);
        }
        //attempt re-connect after 5 seconds
        setTimeout(setupWSClient, 5000);
    });
};

setupWSClient();


/**
 * This goes through all registered clients and sees if they have timed out.
 * Any timed out clients will be cleaned up and removed from the SB server.
 */
var checkTimeouts = function() {
    
    for (var id in clients.byID) {
        var client = clients.byID[id];
        if( getSecondsEpoch() - client.lastUpdate > client.updateTimeout ) {
            //TODO: send 'remove' or 'un-register' command to SB server?
            //  (would need to be implemented server side as well)
            delete clients.byID[id];
            delete clients.byName[client.config.config.name];
            client = undefined;
        }
    }
};

// check timeouts every minute
setInterval(checkTimeouts, 1 * 60 * 1000);

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
//   **Setting Buffer size**
//   Each subscriber defaults to a buffer size of 1, if you want a larger
//  buffer, then specify the property 'bufferSize' with an integer value
//  within the individual subscriber's definition. 
//  (ie. messages:[{name:mySub,type:string,bufferSize:5}...])
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
//timeout:<TIMEOUT>
//   The number of seconds since the last interaction from this client before
//  the client is marked as stale. A stale client can be replaced by a new
//  client with a matching name.
//   The default timeout is 5 minutes.

http.createServer(function (req, res) {
    var config, id, publish, poll, timeout, clientData;
    var output = {error:false,messages:[]};
    res.setHeader("Content-Type", "application/json");

    try {
        if(DEBUG) {
            sys.puts("request: " + req.url);
        }
        
        if(req.method == "GET") {
            
            var vals = url.parse(req.url, true).query;
            config = vals.config;
            if (config){
                try{
                    config = JSON.parse(config);
                }
                catch (error){
                    output.error = true;
                    output.messages.push("Error parsing config: " + error.name + " msg: " + error.message);
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
                    output.messages.push("Error parsing publish: " + error.name + " msg: " + error.message);
                    publish = undefined;
                }
            }
            timeout = vals.timeout;
            
        } else {//"DELETE" "PUT" "POST"...
            /*
            So There is a big discussion here about which HTTP verbs handle which commands.
            The suggestions of REST are that POST is non-idempotent (multiple calls can change server state)
            however all other verbs are idempotent. Since most methods change the state of the server, it seems
            like we should be using POST almost exclusively, but for eand-users, using GET is so easy... and this isn't a "real" HTTP server...
             */
            output.error = true;
            output.messages.push("Unsupported request method of " + req.method);
        }

        //TODO: method
        if (id !== undefined){
            clientData = clients.byID[id];
            clientData.lastUpdate = getSecondsEpoch();
            if (timeout){
                clientData.updateTimeout = timeout;
            }
            if (!clientData){
                output.error = true;
                output.messages.push("ID does not match any registered clients.");
            } else if (config){
                //possibly a client config update
                if (!config.config){
                    output.error = true;
                    output.messages.push("Invalid config format.");
                } else if (config.config.name != clientData.config.config.name){
                    output.error = true;
                    output.messages.push("Supplied client name does not match registered client name.");
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
                        output.messages.push("Error parsing published values: " + error.name + " msg: " + error.message);
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
                    output.received = messages;
                }
            }
        } else if (config){
            if (!config.config){
                output.error = true;
                output.messages.push("Config must contain a 'config' object.");
            } else {
                if (!config.config.name){
                    output.error = true;
                    output.messages.push("Config requires a client 'name'.");
                } else {
                    var existingClient = clients.byName[config.config.name];
                    if (existingClient !== undefined){
                        if (getSecondsEpoch() - existingClient.lastUpdate > existingClient.updateTimeout){
                            delete clients.byName[config.config.name];
                            delete clients.byID[existingClient.id];
                            existingClient = undefined;
                        } else {
                            output.error = true;
                            output.messages.push("Client with provided name already registered with this http_link.");
                        }
                    }
                    if (existingClient === undefined){
                        //valid (perhaps) config
                        clientData = {"config":config};
                        clientData.updateTimeout = timeout || DEFAULT_TIMEOUT;
                        configureClient(clientData, output);
                        if (!output.error){
                            clients.byID[clientID] = clientData;
                            clients.byName[config.config.name] = clientData;
                            id = clientID;
                            clientID++;
                        }
                    }
                }
            }
        } else {
            output.error = true;
            output.messages.push("Send client config or reference registered client by ID.");
        }
    }
    catch (error){
        output.error = true;
        output.messages.push("Unexpected error: " + error.name + " msg: " + error.message);
    }
    output.clientID = id;
    res.end(JSON.stringify(output));
    
}).listen(port);
