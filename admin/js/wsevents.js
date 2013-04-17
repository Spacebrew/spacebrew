var name = gup('name') || window.location.href; 
var server = gup('server') || 'localhost';
var port = gup('port') || '9000';
var debug = gup('debug') || false;

var ws;

var reconnect_timer = undefined;

var setupWebsocket = function(){
	ws = new WebSocket("ws://"+server+":" + Number(port));

	ws.onopen = function() {
		console.log("WebSockets connection opened");
		var adminMsg = { "admin": [
			{"admin": true}
		]};
		ws.send(JSON.stringify(adminMsg));

		///////////////////////////////////////////
		// ADMIN RECONNECT FUNCTIONALITY
		if (reconnect_timer) {
			console.log("[ws.onopen] reconnected successfully - clearing timer");
			reconnect_timer = clearTimeout(reconnect_timer);
			reconnect_timer = undefined;
		}
		///////////////////////////////////////////

	};

	ws.onmessage = function(e) {
		//if (debug) console.log("Got WebSockets message: " + e.data);
		if (debug) console.log("Got WebSockets message:");
		if (debug) console.log(e);
		//try {
			var json = JSON.parse(e.data);
			if (!handleMsg(json)){
				for(var i = 0, end = json.length; i < end; i++){
					handleMsg(json[i]);
				}
			}
		// } catch (err) {
		//     if (debug) console.log('This doesn\'t look like a valid JSON: ', e.data);
		//     return;
		// }
	};

	ws.onclose = function() {
		console.log("[ws.onclose] WebSockets connection closed");

		///////////////////////////////////////////
		// ADMIN RECONNECT FUNCTIONALITY
		if (!reconnect_timer) {
			reconnect_timer = setInterval(function() {
				console.log("[reconnect_timer] attempting to reconnect to spacebrew");
				removeAllClients();
				setupWebsocket();
			}, 5000);			
		}
		///////////////////////////////////////////
	};
};

var clients = [];
var routes = [];

var handleMsg = function(json){
	if (json.config){
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
};

var handleMessageMsg = function(msg){
	// for(var i = clients.length - 1; i >= 0; i--){
	// 	if (clients[i].name === msg.message.clientName
	// 		&& clients[i].remoteAddress === msg.message.remoteAddress){
	// 		break;
	// 	}
	// }
	// var selector2 = "input[name=pub][value='{name}_{addr}_{pubName}_{pubType}']:radio".replace("{name}",.Safetify()).replace("{addr}", msg.message.remoteAddress.Safetify()).replace("{pubName}",msg.message.name.Safetify()).replace("{pubType}",msg.message.type.Safetify());
	// $(selector2).parent().addClass('active');
	var itemSelector = getCommItemSelector(true, msg.message.clientName, msg.message.remoteAddress, msg.message.name, msg.message.type);
	var fromEndpoint = myPlumb.endpoints[itemSelector];
	if (fromEndpoint){
		var getImage = function(active){
			return "img/node-"+($("#"+itemSelector).attr('class').indexOf('sub_') < 0 
				? "open" 
				: "closed")+(active ? "-active-i" : "") + ".png";
		};
		fromEndpoint.setImage(getImage(true));//.setPaintStyle(myPlumb.endpointActiveStyle);
		setTimeout(function(){
			fromEndpoint.setImage(getImage(false));/*setPaintStyle(myPlumb.endpointPaintStyle);*/
		},200);
	}
};

var commSelectorTemplate = Handlebars.compile("{{pub}}_{{Safetify clientName}}_{{Safetify remoteAddress}}_{{Safetify name}}_{{Safetify type}}");
var getCommItem = function(a_bPublisher, a_sClientName, a_sRemoteAddress, a_sName, a_sType){
	return $("#"+getCommItemSelector.apply(this, arguments));
};

var getCommItemSelector = function(a_bPublisher, a_sClientName, a_sRemoteAddress, a_sName, a_sType){
	return commSelectorTemplate({ pub: (a_bPublisher?"pub":"sub"),
									clientName: a_sClientName,
									remoteAddress: a_sRemoteAddress,
									name: a_sName,
									type: a_sType});
};

var routeTemplate;
routeTemplate = Handlebars.compile(document.getElementById( 'route_handlebar' ).textContent);
var clientTemplate;
clientTemplate = Handlebars.compile(document.getElementById( 'client_handlebar' ).textContent);
var pubsubTemplate;
pubsubTemplate = Handlebars.compile(document.getElementById( 'pubsub_handlebar' ).textContent);

var displayRoutes = function(){
	$("#route_list").html(routeTemplate({routes:routes}));
};

var addEndpoints = function(msg){
	var clientName = msg.config.name,
		remoteAddress = msg.config.remoteAddress,
		i,endpoint,currM,id;
	if (msg.config.publish && msg.config.publish.messages){
		i = msg.config.publish.messages.length;
		while (i--){
			currM = msg.config.publish.messages[i];
			id = getCommItemSelector(true, clientName, remoteAddress, currM.name, currM.type);
			endpoint = jsPlumb.addEndpoint(id, myPlumb.sourceEndpoint);
			myPlumb.endpoints[id] = endpoint;
		}
	}
	if (msg.config.subscribe && msg.config.subscribe.messages){
		i = msg.config.subscribe.messages.length;
		while(i--){
			currM = msg.config.subscribe.messages[i];
			id = getCommItemSelector(false, clientName, remoteAddress, currM.name, currM.type);
			endpoint = jsPlumb.addEndpoint(id, myPlumb.targetEndpoint);
			myPlumb.endpoints[id] = endpoint;
		}
	}
};

var handleConfigMsg = function(msg){
	for(var j = 0; j < clients.length; j++){
		if (clients[j].name === msg.config.name
			&& clients[j].remoteAddress === msg.config.remoteAddress){
			//TODO: if the client already has a config, lets cleanup
			//the old endpoints and old markup
			clients[j].config = msg.config;
			var itemsMarkup = $(pubsubTemplate(clients[j]));
			itemsMarkup.find(".itemwrapper").click(clickItem).hover(overItem, outItem);
			//itemsMarkup.find(".deletebutton").click(clickDelete);
			var client = $("#"+msg.config.name.Safetify()+"_"+msg.config.remoteAddress.Safetify());
			client.append(itemsMarkup);
			addEndpoints(msg);
			//update the description
			if (msg.config.description){
				var idPart ="info_"+msg.config.name.Safetify()+"_"+msg.config.remoteAddress.Safetify(); 
				$("#button_"+idPart).css("display","inline-block");
				$("#"+idPart+" span").html(msg.config.description);
				client.find(".clientnickname, .clientname").attr("title",msg.config.description);
			}
			return;
		}
	}

	//if we did not find a matching client, then add this one
	var newClient = {name:msg.config.name, remoteAddress:msg.config.remoteAddress};
	var clientMarkup = $(clientTemplate(newClient));
	clientMarkup.find(".infobutton").click(clickInfo);
	$("#client_list").append(clientMarkup);
	clients.push(newClient);
	//and then updated it with the additional info.
	handleConfigMsg(msg);
};

var removeClient = function(client){
	var clientName = client.name,
		remoteAddress = client.remoteAddress,
		name, type;
	$("#"+clientName.Safetify()+"_"+remoteAddress.Safetify()).remove();
	
	if (client.config && client.config.publish && client.config.publish.messages){
		for(var i = 0; i < client.config.publish.messages.length; i++){
			name = client.config.publish.messages[i].name;
			type = client.config.publish.messages[i].type;
			jsPlumb.deleteEndpoint(myPlumb.endpoints[["pub",clientName, remoteAddress, name, type].map(Safetify).join("_")]);
		}
	}
	if (client.config && client.config.subscribe && client.config.subscribe.messages){
		for(var i = 0; i < client.config.subscribe.messages.length; i++){
			name = client.config.subscribe.messages[i].name;
			type = client.config.subscribe.messages[i].type;
			jsPlumb.deleteEndpoint(myPlumb.endpoints[["sub",clientName, remoteAddress, name, type].map(Safetify).join("_")]);
		}
	}
};

var addConnection = function(msg){
	var item = msg.route.publisher;
	var sourceid = getCommItemSelector(true, item.clientName, item.remoteAddress, item.name, item.type);
	item = msg.route.subscriber;
	var targetid = getCommItemSelector(false, item.clientName, item.remoteAddress, item.name, item.type);
	var source = myPlumb.endpoints[sourceid];
	var target = myPlumb.endpoints[targetid];
	source.setImage("img/node-closed.png");
	target.setImage("img/node-closed.png");
	if (!myPlumb.connections[sourceid]){
		myPlumb.connections[sourceid] = {};
	}
	if (!myPlumb.connections[sourceid][targetid]){
		var connection = jsPlumb.connect({source:source,target:target}, myPlumb.connectionParams);
		myPlumb.connections[sourceid][targetid] = connection;
	}
	handleSelecting(sourceid, targetid);
};

var handleSelecting = function(pubId, subId){
	$("#"+subId).addClass(pubId);
	$("#"+pubId).addClass(subId);
	// if (currState == PUB_SELECTED){
	// 	if (pubId == $(".publisher.selected").prop('id')){
	// 		$("#"+subId).addClass("selected");
	// 	}
	// } else if (currState == SUB_SELECTED){
	// 	if (subId == $(".subscriber.selected").prop('id')){
	// 		$("#"+pubId).addClass("selected");
	// 	}
	// }
};

var handleUnselecting = function(pubId, subId){
	var subscriber = $("#"+subId);
	var publisher = $("#"+pubId);
	subscriber.removeClass(pubId);
	publisher.removeClass(subId);
	if (subscriber.attr('class').indexOf('pub_') < 0){
		myPlumb.endpoints[subId].setImage("img/node-open.png");
	}
	if (publisher.attr('class').indexOf('sub_') < 0){
		myPlumb.endpoints[pubId].setImage("img/node-open.png");
	}
};

var removeConnection = function(msg){
	var item = msg.route.publisher;
	var sourceid = getCommItemSelector(true, item.clientName, item.remoteAddress, item.name, item.type);
	item = msg.route.subscriber;
	var targetid = getCommItemSelector(false, item.clientName, item.remoteAddress, item.name, item.type);
	if (myPlumb.connections[sourceid] && myPlumb.connections[sourceid][targetid]){
		jsPlumb.detach(myPlumb.connections[sourceid][targetid]);
		handleUnselecting(sourceid, targetid);
		myPlumb.connections[sourceid][targetid] = undefined;
	}
};

var handleRouteMsg = function(msg){
	if (msg.route.type === 'add'){
		routes.push({publisher:msg.route.publisher,
					subscriber:msg.route.subscriber});
		addConnection(msg);
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
				removeConnection(msg);
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
				removeClient(clients.splice(j, 1)[0]);
				break;
			}
		}
	}
};

///////////////////////////////////////////
// ADMIN RECONNECT FUNCTIONALITY
var removeAllClients = function(){
	for(var j = clients.length - 1; j >= 0; j--){
		removeClient(clients[j]);
	}
	clients = [];
	routes = [];
};
/////////////////////////////////////////////////