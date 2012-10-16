var WebSocketClient = require('ws');

var clients = [];
var routes = [];

var receivedMessage = function(data){
    console.log(data);
    if (data){
        var json = JSON.parse(data);
        if (!handleMessage(json)){
            for(var i = 0, end = json.length; i < end; i++){
                handleMessage(json[i]);
            }
        }
    }
};

// create the client
wsClient = new WebSocketClient("ws://localhost:9000");
wsClient.on("open", function(){
    console.log("connected");
    var adminMsg = { "admin": [
        {"admin": true}
    ]};
    wsClient.send(JSON.stringify(adminMsg));
});
wsClient.on("message", receivedMessage);

var handleMessage = function(json){
    if (json.config){
        handleConfigMessage(json);
    } else if (json.remove){
        handleRemoveMessage(json);
    } else {
        return false;
    }
    return true;
};

var areClientsEqual = function(A, B){
    return A.name === B.name && A.remoteAddress === B.remoteAddress; 
}

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
}

var handleConfigMessage = function(msg){
    //see if we want to keep or discard this client
    //based on its config. only text -> text clients are
    //logged
    var bKeep = msg.config.publish && msg.config.publish.messages.length == 1 && msg.config.publish.messages[0].type == 'string' &&
                msg.config.subscribe && msg.config.subscribe.messages.length == 1 && msg.config.subscribe.messages[0].type == 'string';
    //see if we are updating a current client
    for (var i = clients.length-1; i >= 0; i--){
        if (areClientsEqual(clients[i], msg.config)){
            //we are updating an existing client
            if (bKeep){
                console.log("################### updated a client");
                clients[i] = msg.config;
            } else {
                //remove the client, 
                //it does not fit the requirements anymore
                console.log("################### removed a client");
                clients.splice(i,1);
            }
            return;
        }
    }
    //we didn't find it
    //add it if necessary
    if (bKeep){
        console.log("################ added a client");
        for(var i = clients.length-1; i>= 0; i--){
            wsClient.send(JSON.stringify({
                route:{type:'add',
                    publisher:{clientName:clients[i].name,
                                name:clients[i].publish.messages[0].name,
                                type:"string",
                                remoteAddress:clients[i].remoteAddress},
                    subscriber:{clientName:msg.config.name,
                                name:msg.config.subscribe.messages[0].name,
                                type:"string",
                                remoteAddress:msg.config.remoteAddress}}
            }));
            wsClient.send(JSON.stringify({
                route:{type:'add',
                    subscriber:{clientName:clients[i].name,
                                name:clients[i].subscribe.messages[0].name,
                                type:"string",
                                remoteAddress:clients[i].remoteAddress},
                    publisher:{clientName:msg.config.name,
                                name:msg.config.publish.messages[0].name,
                                type:"string",
                                remoteAddress:msg.config.remoteAddress}}
            }));
        }
        clients.push(msg.config);
    }
}