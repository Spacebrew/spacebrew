$(document).ready( function() {
    //setup();
    //$("#btnRoute").on('click', doroute);
    $("#btnRouteRadio").on('click', dorouteradio);
    //$("#ddlPubClient").on('change',updatePubClient);
    //$("#ddlSubClient").on('change',updateSubClient);
});

// var updatePubClient = function(e){
//     if (e){e.preventDefault();};
// }

// var updateSubClient = function(e){
//     if (e){e.preventDefault();};
// }

// var doroute = function(e){
//     if (e){e.preventDefault();};
//     ws.send(JSON.stringify({
//         route:{type:'add',
//                 publisher:{clientName:clients[$("#ddlPubClient").val()].name,
//                             name:$("#pubName").val(),
//                             type:$("#ddlType").val(),
//                             remoteAddress:clients[$("#ddlPubClient").val()].remoteAddress},
//                 subscriber:{clientName:clients[$("#ddlSubClient").val()].name,
//                             name:$("#subName").val(),
//                             type:$("#ddlType").val(),
//                             remoteAddress:clients[$("#ddlSubClient").val()].remoteAddress}}
//     }));
// };

function gup( name ) {
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return "";
  else
    return results[1];
}

var name = gup('name') || window.location.href; 
var server = gup('server') || 'localhost';

var dorouteradio = function(e){
    if (e){e.preventDefault();};
    var selectedPub = $("input[name=pub]:radio:checked").val();
    var selectedSub = $("input[name=sub]:radio:checked").val();
    if (selectedPub && selectedSub){
        selectedPub = selectedPub.split(':').map(unescape);
        selectedSub = selectedSub.split(':').map(unescape);
        if (selectedPub.length == 4 && selectedSub.length == 4){
            ws.send(JSON.stringify({
                route:{type:'add',
                        publisher:{clientName:selectedPub[0],
                                    name:selectedPub[2],
                                    type:selectedPub[3],
                                    remoteAddress:selectedPub[1]},
                        subscriber:{clientName:selectedSub[0],
                                    name:selectedSub[2],
                                    type:selectedSub[3],
                                    remoteAddress:selectedSub[1]}}
            }));
        }
    }
};

var dorouteremove = function(index){
    if (index >= 0 && index < routes.length){
        var toRemove = routes.splice(index, 1);
        if (toRemove.length > 0){
            toRemove = toRemove[0];
            ws.send(JSON.stringify({
                route:{type:'remove',
                        publisher:toRemove.publisher,
                        subscriber:toRemove.subscriber}
            }));
        }
    }
}

var ws = new WebSocket("ws://"+server+":9000");
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
            if (!handleMsg(json)){
                for(var i = 0, end = json.length; i < end; i++){
                    handleMsg(json[i]);
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

var clients = [];
var routes = [];

var handleMsg = function(json){
    if (json.name){
        handleNameMsg(json);
    } else if (json.config){
        handleConfigMsg(json);
    } else if (json.message){
        handleMessageMsg(json);
    } else if (json.route){
        handleRouteMsg(json);
    } else if (json.remove){
        handleRemoveMsg(json);
    } else if (json.admin){
        //do nothing
    } else {
        return false;
    }
    return true;
}

var handleMessageMsg = function(msg){
    for(var i = clients.length - 1; i >= 0; i--){
        if (clients[i].name === msg.message.clientName
            && clients[i].remoteAddress === msg.message.remoteAddress){
            var selector = "#client_list li:eq("+i+")";
            $(selector).addClass('active');
            setTimeout(function(){$(selector).removeClass('active');},200);
            break;
        }
    }
    var selector2 = "input[name=pub][value='{name}:{addr}:{pubName}:{pubType}']:radio".replace("{name}",msg.message.clientName).replace("{addr}", msg.message.remoteAddress).replace("{pubName}",msg.message.name).replace("{pubType}",msg.message.type);
    $(selector2).parent().addClass('active');
    setTimeout(function(){$(selector2).parent().removeClass('active');},200);
};

var handleNameMsg = function(msg){
    for(var i = 0; i < msg.name.length; i++){
        clients.push({name:msg.name[i].name, remoteAddress:msg.name[i].remoteAddress});
    };
    generateList();
};

//generates the list of clients for viewing
var generateList = function(){
    var olHtml = '';
    var ddlHtml = '<option value="">Select One</option>';
    for(var i = 0; i < clients.length; i++){
        var name=clients[i].name;
        var addr = clients[i].remoteAddress, pubColumn = '<div class="span3 offset2 publishers">', title = '', subColumn = '<div class="span3 subscribers">';
        if (clients[i].config){
            if (clients[i].config.publish && clients[i].config.publish.messages){
                for(var j = clients[i].config.publish.messages.length - 1; j >= 0; j--){
                    var currM = clients[i].config.publish.messages[j];
                    pubColumn += '<label class="radio"><input type="radio" name="pub" value="{name}:{addr}:{pubName}:{pubType}">{pubName}, {pubType}</label>'.replace(/{pubName}/g,escape(currM.name)).replace(/{pubType}/g,escape(currM.type));
                }
            }
            if (clients[i].config.subscribe && clients[i].config.subscribe.messages){
                for (var j = clients[i].config.subscribe.messages.length - 1; j >= 0; j--){
                    var currM = clients[i].config.subscribe.messages[j];
                    subColumn += '<label class="radio"><input type="radio" name="sub" value="{name}:{addr}:{subName}:{subType}">{subName}, {subType}</label>'.replace(/{subName}/g,escape(currM.name)).replace(/{subType}/g,escape(currM.type));
                }
            }
            title = clients[i].config.description;
        }
        pubColumn += '</div>';
        subColumn += '</div>';
        var leftColumn = '<div class="span8 client" title="{title}">{name} @ {addr}<div class="row">{col2}{col3}</div></div>';
        olHtml += '<li><div class="row">{col1}</div></li>'.replace(/{col1}/g,leftColumn).replace(/{col2}/g,pubColumn).replace(/{col3}/g,subColumn).replace(/{name}/g,escape(name)).replace(/{addr}/g,escape(addr)).replace(/{title}/g,title);
        ddlHtml += '<option value="{i}">{i}</option>'.replace(/{i}/g,i);
    };
    $("#client_list").html(olHtml);
    $("#ddlSubClient").html(ddlHtml);
    $("#ddlPubClient").html(ddlHtml);
};

var displayRoutes = function(){
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
}

var handleConfigMsg = function(msg){
    for(var j = 0; j < clients.length; j++){
        if (clients[j].name === msg.config.name
            && clients[j].remoteAddress === msg.config.remoteAddress){
            clients[j].config = msg.config;
            break;
        }
    }
    generateList();
};

var handleRouteMsg = function(msg){
    if (msg.route.type === 'add'){
        routes.push({publisher:msg.route.publisher,
                    subscriber:msg.route.subscriber});
    } else if (msg.route.type === 'remove'){
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
    displayRoutes();
};

var handleRemoveMsg = function(msg){
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
    }
    generateList();
};