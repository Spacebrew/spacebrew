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
        console.log("Got WebSockets message:");
        console.log(e);
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
    if (json.name){
        this.handleNameMsg(json);
    } else if (json.config){
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
            
    // for(var i = clients.length - 1; i >= 0; i--){
    //     if (clients[i].name === msg.message.clientName
    //         && clients[i].remoteAddress === msg.message.remoteAddress){
    //         var selector = "#client_list li:eq("+i+")";
    //         $(selector).addClass('active');
    //         setTimeout(function(){$(selector).removeClass('active');},200);
    //         break;
    //     }
    // }
    // var selector2 = "input[name=pub][value='{name}:{addr}:{pubName}:{pubType}']:radio".replace("{name}",msg.message.clientName).replace("{addr}", msg.message.remoteAddress).replace("{pubName}",msg.message.name).replace("{pubType}",msg.message.type);
    // $(selector2).parent().addClass('active');
    // setTimeout(function(){$(selector2).parent().removeClass('active');},200);
};

myWS.handleNameMsg = function(msg){
    for(var i = 0; i < msg.name.length; i++){
        clients.push({name:msg.name[i].name, remoteAddress:msg.name[i].remoteAddress});
        var newDiv = $("<div>").addClass("window").prop("id",msg.name[i].name.Safetify()+sep+msg.name[i].remoteAddress.Safetify());
        newDiv.append($("<div>").css("white-space","nowrap").text(msg.name[i].name));
        jsPlumb.draggable(newDiv);
        $("#bucket").append(newDiv);
    };
    this.generateList();
};

//generates the list of clients for viewing
myWS.generateList = function(){
    return;
    var olHtml = '';
    var ddlHtml = '<option value="">Select One</option>';
    for(var i = 0; i < clients.length; i++){
        var name=clients[i].name;
        var addr = clients[i].remoteAddress, pubColumn = '<div class="span3 offset2 publishers">', title = '', subColumn = '<div class="span3 subscribers">';
        if (clients[i].config){
            if (clients[i].config.publish && clients[i].config.publish.messages){
                for(var j = clients[i].config.publish.messages.length - 1; j >= 0; j--){
                    var currM = clients[i].config.publish.messages[j];
                    pubColumn += '<label class="radio"><input type="radio" name="pub" value="{name}:{addr}:{pubName}:{pubType}">{pubName}, {pubType}</label>'.replace(/{pubName}/g,currM.name.Safetify()).replace(/{pubType}/g,currM.type.Safetify());
                }
            }
            if (clients[i].config.subscribe && clients[i].config.subscribe.messages){
                for (var j = clients[i].config.subscribe.messages.length - 1; j >= 0; j--){
                    var currM = clients[i].config.subscribe.messages[j];
                    subColumn += '<label class="radio"><input type="radio" name="sub" value="{name}:{addr}:{subName}:{subType}">{subName}, {subType}</label>'.replace(/{subName}/g,currM.name.Safetify()).replace(/{subType}/g,currM.type.Safetify());
                }
            }
            title = clients[i].config.description;
        }
        pubColumn += '</div>';
        subColumn += '</div>';
        var leftColumn = '<div class="span8 client" title="{title}">{name} @ {addr}<div class="row">{col2}{col3}</div></div>';
        olHtml += '<li><div class="row">{col1}</div></li>'.replace(/{col1}/g,leftColumn).replace(/{col2}/g,pubColumn).replace(/{col3}/g,subColumn).replace(/{name}/g,name.Safetify()).replace(/{addr}/g,addr.Safetify()).replace(/{title}/g,title);
        ddlHtml += '<option value="{i}">{i}</option>'.replace(/{i}/g,i);
    };
    $("#client_list").html(olHtml);
    $("#ddlSubClient").html(ddlHtml);
    $("#ddlPubClient").html(ddlHtml);
};

myWS.displayRoutes = function(){
    var html = '';
    var even = false;
    for(var i = routes.length - 1; i >= 0; i--){
        var pub = routes[i].publisher;
        var pubColumn = "<div class='span5'>{name} @ {addr}: {pubName}, {pubType}</div>".replace("{name}",pub.clientName).replace("{addr}",pub.remoteAddress).replace("{pubName}",pub.name).replace("{pubType}",pub.type);
        var sub = routes[i].subscriber;
        var subColumn = "<div class='span5'>{name} @ {addr}: {subName}, {subType}</div>".replace("{name}",sub.clientName).replace("{addr}",sub.remoteAddress).replace("{subName}",sub.name).replace("{subType}",sub.type);
        var button = '<div class="span1"><button id="btnRouteRemove{index}" onclick="dorouteremove({index})" class="btn btn-inverse btn-mini">remove</button></div>';
        html += '<div class="row {even}">{col1}<div class="span1">---TO---></div>{col3}{button}</div>'.replace("{col1}",pubColumn).replace("{col3}",subColumn).replace("{button}",button).replace("{even}",(even?"even":"odd")).replace(/{index}/g,i);
        even = !even;
    }
    $("#route_list").html(html);
};

myWS.handleConfigMsg = function(msg){
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
    // [{commType:'string',source:true,label:'test'},
    //                                         {commType:'bool', source:true,label:'btest'},
    //                                         {commType:'int',source:true,label:'itest'},
    //                                         {commType:'bool',source:false,label:'intest'},
    //                                         {commType:'string',source:false,label:'instest'},
    //                                         {commType:'int',source:false,label:'intintest'}]);
    for(var j = 0; j < clients.length; j++){
        if (clients[j].name === msg.config.name
            && clients[j].remoteAddress === msg.config.remoteAddress){
            clients[j].config = msg.config;
            break;
        }
    }
    this.generateList();
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
    this.displayRoutes();
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
        var el = $("#"+msg.remove[i].name);
        jsPlumb.removeAllEndpoints(el);
        el.remove();
    }
    this.generateList();
};