var fs = require("fs");
var WebSocketClient = require('websocket').client;
var stdin = process.openStdin();

//print out info:
var l = console.log;
l("This is a CLI admin for maintaining persistent routes in a spacebrew network.");
l("commands:");
l("  ls, add, remove, save, load, help, exit");

var clients = [];
var routes = [];
var connection;
var persistentRoutes = [];

var clean = function(str){
    return str.replace(/(^\s*|\s*$)/g,'');
}

stdin.on('data',function(command){
    //strip leading and trailing spaces
    command = clean(command.toString());
    if (command == "ls"){
        //list all publishers, then all subscribers, then all persistent routes
        var n = 0;
        l("publishers:");
        for(var i = 0; i < clients.length; i++){
            for (var j = 0; j < clients[i].publish.messages.length; j++){
                l("  "+(n++)+": "+clients[i].name+", "+clients[i].publish.messages[j].name);
            }
        }
        l("subscribers:");
        for(var i = 0; i < clients.length; i++){
            for (var j = 0; j < clients[i].subscribe.messages.length; j++){
                l("  "+(n++)+": "+clients[i].name+", "+clients[i].subscribe.messages[j].name);
            }
        }
        n = 0;
        l("persistent routes:");
        for (var i = 0; i < persistentRoutes.length; i++){
            var r = persistentRoutes[i];
            l("  "+(n++)+": "+r.publisher.clientName+","+r.publisher.name+" -> "+r.subscriber.clientName+","+r.subscriber.name);
        }
    } else if (command.indexOf("add") == 0){
        //add the specified persistent route
        //input is either an index pair, or a specified client,pub/sub pairs
        command = command.substr("add ".length);
        parts = command.split(',').map(clean);
        if (parts.length == 2){
            //we are dealing with indices
            l("please explicitly specify publisher and subscriber client and name");
        } else if (parts.length == 4){
            persistentRoutes.push({publisher:{clientName:parts[0],name:parts[1]},subscriber:{clientName:parts[2],name:parts[3]}});
            //and now lets make sure we are all connected!
            ensureConnected();
            l("added persistent route");
        } else {
            l("invalid arguments, must be in the form of \"add <publisher client>,<publisher name>,<subscriber client>,<subscriber name>\"");
        }
    } else if (command.indexOf("remove") == 0){
        //removes the specified persistent route
        var index = parseInt(command.substr("remove ".length));
        if (index != index){
            //NaN
            l("invalid arguments, must be in the form of \"remove <index>\" where <index> matches the appropriate index as listed via the \"ls\" command");
        } else if (index < 0 || index >= persistentRoutes.length){
            l("index out of range");
        } else{
            var removed = persistentRoutes.splice(index, 1);
            l("removed route");
        }
    } else if (command == "save"){
        fs.writeFile('./persistent_config.json', JSON.stringify(persistentRoutes), function(err){
            if (err){
                l("there was an error while writing the config file");
                l(err);
            } else {
                l("config saved to persistent_config.json");
            }
        });
    } else if (command == "load"){
        if (loadConfig(true)){
            l("successfully loaded");
        }
    } else if (command == "help"){
        l("This is a CLI admin for maintaining persistent routes in a spacebrew network.");
        l("commands:");
        l("  ls");
        l("    lists all clients, their publishers and subscribers, and the configured persistent routes");
        l("  add <publisher>,<subscriber>");
        l("    adds the route from the specified <publisher> to <subscriber> to the list of maintained routes.");
        l("    you can either reference publishers and subscribers by <client_name>,<publisher/subscriber_name>");
        l("    or by index as listed in the 'ls' command [not yet implemented]");
        l("    examples:");
        l("      add button,click,signage,power");
        l("      add 1,5 [not yet implemented]");
        l("  remove <index>");
        l("    removes the specified persistent route from being persistent");
        l("    will also break the route if it is currently connected [not yet implemented]");
        l("  save");
        l("    saves the current persistent route list to disk");
        l("  load");
        l("    overwrites the current persistent route list with the one on disk");
        l("    when the server starts up, it will automatically load an existing list from disk");
        l("  exit");
        l("    quits this persistent route admin (same as [ctrl]+c)");
    } else if (command == 'exit'){
        process.exit();
    } else {
        l("unrecognized command, use \"help\" to see valid commands");
    }
});

var loadConfig = function(expectFile){
    try{
        var config = fs.readFileSync("./persistent_config.json");
        try{
            persistentRoutes = JSON.parse(config);
            return true;
        }catch(err){
            l("there was an error while parsing the config file");
            l(err);
        }
    } catch(err){
        if (expectFile){
            l("there was an error while reading the config file");
            l(err);
        }
    }
    return false;
};
//auto-load config on startup
loadConfig(false);

var ensureConnected = function(){
    //for each publisher, if that publisher is in the persistent routes
    //      for each subscriber, if that subscriber is the other end of that persistent route
    //          send the add route message

    //for each publisher
    for (var i = 0; i < clients.length; i++){
        for (var j = 0; j < clients[i].publish.messages.length; j++){
            //for each persistent route
            for (var k = 0; k < persistentRoutes.length; k++){
                if (clients[i].name == persistentRoutes[k].publisher.clientName &&
                    clients[i].publish.messages[j].name == persistentRoutes[k].publisher.name){
                    //for each subscriber
                    for (var m = 0; m < clients.length; m++){
                        for (var n = 0; n < clients[m].subscribe.messages.length; n++){
                            if (clients[m].name == persistentRoutes[k].subscriber.clientName &&
                                clients[m].subscribe.messages[n].name == persistentRoutes[k].subscriber.name){
                                //send route message
                                connection.send(JSON.stringify({
                                    route:{type:'add',
                                        publisher:{clientName:persistentRoutes[k].publisher.clientName,
                                                    name:persistentRoutes[k].publisher.name,
                                                    type:clients[i].publish.messages[j].type,
                                                    remoteAddress:clients[i].remoteAddress},
                                        subscriber:{clientName:persistentRoutes[k].subscriber.clientName,
                                                    name:persistentRoutes[k].subscriber.name,
                                                    type:clients[m].subscribe.messages[n].type,
                                                    remoteAddress:clients[m].remoteAddress}}
                                }));
                            }
                        }
                    }
                }
            }
        }
    }
};

// create the wsclient and register as an admin
wsClient = new WebSocketClient();
wsClient.on("connect", function(conn){
    connection = conn;
    console.log("connected");
    connection.on("message",receivedMessage);
    var adminMsg = { "admin": [
        {"admin": true}
    ]};
    connection.send(JSON.stringify(adminMsg));
});
wsClient.connect("ws://localhost:9000");

var receivedMessage = function(data){
    //console.log(data);
    if (data.utf8Data){
        var json = JSON.parse(data.utf8Data);
        if (!handleMessage(json)){
            for(var i = 0, end = json.length; i < end; i++){
                handleMessage(json[i]);
            }
        }
    }
};

var handleMessage = function(json){
    if (json.name || json.message || json.admin){
        //do nothing
    } else if (json.config){
        handleConfigMessage(json);
    } else if (json.route){
        if (json.route.type === 'remove'){
            handleRouteRemoveMessage(json);
        }
    } else if (json.remove){
        handleRemoveMessage(json);
    } else {
        return false;
    }
    return true;
};

var handleRouteRemoveMessage = function(msg){
    //check against persistent routes to re-connect if necessary
    ensureConnected();
};

var areClientsEqual = function(A, B){
    return A.name === B.name && A.remoteAddress === B.remoteAddress; 
};

var handleRemoveMessage = function(msg){
    for (var j = msg.remove.length-1; j >= 0; j--){
        for (var i = clients.length - 1; i >= 0; i--){
            if (areClientsEqual(clients[i], msg.remove[j])){
                clients.splice(i, 1);
                console.log("################### removed a client");
                break;
            }
        }
    }
};

var handleConfigMessage = function(msg){
    var added = false;
    //see if we are updating a current client
    for (var i = clients.length-1; i >= 0; i--){
        if (areClientsEqual(clients[i], msg.config)){
            //we are updating an existing client
            console.log("################### updated a client");
            clients[i] = msg.config;
            added = true;
        }
    }
    //we didn't find it
    //add it if necessary
    if (!added){
        console.log("################ added a client");
        clients.push(msg.config);
    }
    ensureConnected();
};