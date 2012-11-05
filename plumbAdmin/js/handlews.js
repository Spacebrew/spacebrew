var name = gup('name') || window.location.href; 
var server = gup('server') || 'localhost';

var clients = [];
var routes = [];
var ignoreMessages = [];
var ignoreActions = [];
var sep = "_";

var ws;
setupWS = function(){
    ws = new WebSocket("ws://"+server+":9000");

    ws.onopen = function() {
        console.log("WebSockets connection opened");
        var adminMsg = { "admin": [
            {"admin": true}
        ]};
        ws.send(JSON.stringify(adminMsg));
    }
    ws.onmessage = function(e) {
        //console.log("Got WebSockets message: " + e.data);
        // console.log("Got WebSockets message:");
        // console.log(e);
        //try {
            var json = JSON.parse(e.data);
            if (!myWS.handleMsg(json)){
                for(var i = 0, end = json.length; i < end; i++){
                    myWS.handleMsg(json[i]);
                }
            }
        // } catch (err) {
        //     console.log('This doesn\'t look like a valid JSON: ', e.data);
        //     return;
        // }
    }
    ws.onclose = function() {
        console.log("WebSockets connection closed");
    }
};
var myWS = {};

myWS.handleMsg = function(json){
    if (json.config){
        this.handleConfigMsg(json);
    } else if (json.message){
        this.handleMessageMsg(json);
    } else if (json.route){
        this.handleRouteMsg(json);
    } else if (json.remove){
        this.handleRemoveMsg(json);
    } else if (json.admin){
        //do nothing
    } else {
        return false;
    }
    return true;
}

myWS.handleMessageMsg = function(msg){
    var endpointList = {string:{source:myPlumb.sourceEndpointString,target:myPlumb.targetEndpointString},
                        boolean:{source:myPlumb.sourceEndpointBool,target:myPlumb.targetEndpointBool},
                        number:{source:myPlumb.sourceEndpointInt,target:myPlumb.targetEndpointInt}};

    var from = msg.message;
    var endpoint = myPlumb.endpoints[[from.clientName, from.remoteAddress, from.type, from.name].map(Safetify).join(sep)];
    endpoint.setPaintStyle(myPlumb.activeEndpointPaintStyle);
    setTimeout(function(){endpoint.setPaintStyle(endpointList[from.type].source.paintStyle);},200);
};

myWS.handleConfigMsg = function(msg){
    clients.push({name:msg.config.name, remoteAddress:msg.config.remoteAddress});
    var newDiv = $("<div>").addClass("window").prop("id",msg.config.name.Safetify()+sep+msg.config.remoteAddress.Safetify());
    newDiv.append($("<div>").css("white-space","nowrap").text(msg.config.name));
    jsPlumb.draggable(newDiv);
    $("#bucket").append(newDiv);

    var endpointList = [];
    if (msg.config.publish && msg.config.publish.messages){
        for (var i = 0; i < msg.config.publish.messages.length; i++){
            var currPub = msg.config.publish.messages[i];
            endpointList.push({commType:currPub.type,source:true,label:currPub.name});
        }
    }
    if (msg.config.subscribe && msg.config.subscribe.messages){
        for (var i = 0; i < msg.config.subscribe.messages.length; i++){
            var currSub = msg.config.subscribe.messages[i];
            endpointList.push({commType:currSub.type, source:false, label:currSub.name});
        }
    }
    myPlumb.addEndpoints(msg.config.name.Safetify()+sep+msg.config.remoteAddress.Safetify(), endpointList);
    for(var j = 0; j < clients.length; j++){
        if (clients[j].name === msg.config.name
            && clients[j].remoteAddress === msg.config.remoteAddress){
            clients[j].config = msg.config;
            break;
        }
    }
};

myWS.handleRouteMsg = function(msg){
    for(var i = 0; i < ignoreMessages.length; i++){
        var currIgnore = ignoreMessages[i];
        toCompare = [["type"],['publisher','clientName'],['publisher','remoteAddress'],['publisher','type'],['publisher','name'],
                    ['subscriber','clientName'],['subscriber','remoteAddress'],['subscriber','type'],['subscriber','name']];
        var matches = true;
        for(var j = toCompare.length - 1; j >= 0 && matches; j--){
            var currComp = toCompare[j];
            var from = currIgnore.route,
                to = msg.route;
            var numLevels = currComp.length;
            for(var k = 0; k < numLevels; k++){
                var currLevel = currComp[k];
                from = from[currLevel];
                to = to[currLevel];
            }
            if(from != to){
                matches = false;
            }
        }
        if (matches){
            ignoreMessages.splice(i,1);
            console.log("ignoring message");
            return;
        }
    }
    ignoreActions.push(msg);
    var pubUUID = msg.route.publisher.clientName.Safetify()+sep+msg.route.publisher.remoteAddress.Safetify()+sep+
                    msg.route.publisher.type.Safetify()+sep+msg.route.publisher.name.Safetify(),
        subUUID = msg.route.subscriber.clientName.Safetify()+sep+msg.route.subscriber.remoteAddress.Safetify()+sep+
                    msg.route.subscriber.type.Safetify()+sep+msg.route.subscriber.name.Safetify();
    if (msg.route.type === 'add'){
        if (!myPlumb.connections[pubUUID]){
            myPlumb.connections[pubUUID] = {};
        }
        if (!myPlumb.connections[pubUUID][subUUID]){
            var connection = jsPlumb.connect({source:myPlumb.endpoints[pubUUID], 
                                                target:myPlumb.endpoints[subUUID]});
            connection.setPaintStyle(myPlumb.programmaticConnectorPaintStyle);
            myPlumb.connections[pubUUID][subUUID] = connection;
            myPlumb.revConnections[connection.id] = {source:pubUUID, target:subUUID};
        } else {
            //we already have this connection, don't attempt to add it again
            //we pushed the action already, so let's pop it
            ignoreActions.pop();
        }

        routes.push({publisher:msg.route.publisher,
                    subscriber:msg.route.subscriber});
    } else if (msg.route.type === 'remove'){
        if (myPlumb.connections[pubUUID] && myPlumb.connections[pubUUID][subUUID]){
            var connection = myPlumb.connections[pubUUID][subUUID];
            jsPlumb.detach(connection);
            myPlumb.connections[pubUUID][subUUID] = undefined;
            myPlumb.revConnections[connection.id] = undefined;
        }

        for(var i = routes.length - 1; i >= 0; i--){
            var myPub = routes[i].publisher;
            var thePub = msg.route.publisher;
            var mySub = routes[i].subscriber;
            var theSub = msg.route.subscriber;
            if (myPub.clientName === thePub.clientName
                && myPub.name === thePub.name
                && myPub.type === thePub.type
                && myPub.remoteAddress === thePub.remoteAddress
                && mySub.clientName === theSub.clientName
                && mySub.name === theSub.name
                && mySub.type === theSub.type
                && mySub.remoteAddress === theSub.remoteAddress){
                routes.splice(i, 1);
            }
        }
    }
};

myWS.handleRemoveMsg = function(msg){
    //for each entry in the remove list
    //for each entry in the clients list
    //if the name & address match, then remove it from the list
    for(var i = 0; i < msg.remove.length; i++){
        for(var j = 0; j < clients.length; j++){
            if (clients[j].name === msg.remove[i].name
                && clients[j].remoteAddress === msg.remove[i].remoteAddress){
                clients.splice(j, 1);
                break;
            }
        }
        var el = $("#"+msg.remove[i].name.Safetify()+"_"+msg.remove[i].remoteAddress.Safetify());
        jsPlumb.removeAllEndpoints(el);
        el.remove();
    }
};