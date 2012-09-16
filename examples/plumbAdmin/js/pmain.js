var myPlumb = {};

myPlumb.endpoints = {};
myPlumb.connections = {};
myPlumb.revConnections = {};

myPlumb.shouldIgnore = function(msg){
    for(var i = 0; i < ignoreActions.length; i++){
        var currIgnore = ignoreActions[i];
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
            ignoreActions.splice(i,1);
            return true;
        }
    }
    return false;
};

myPlumb.init = function(connection) {
	console.log("init");
	console.log(connection);
	var pubInfo, subInfo, pubUUID, subUUID;
	for (var i = 0; i < connection.endpoints.length; i++){
		if (connection.endpoints[i].isSource){
			pubInfo = connection.endpoints[i];
		} else {
			subInfo = connection.endpoints[i];
		}
	}
	pubUUID = pubInfo.getParameter("uuid");
	subUUID = subInfo.getParameter("uuid");
	pubInfo = pubUUID.split(sep).map(Unsafetify);
	subInfo = subUUID.split(sep).map(Unsafetify);
	var clientName = 0,addr = 1, type = 2, name = 3;

	var msg = {
        route:{type:'add',
                publisher:{clientName:pubInfo[clientName],
                            name:pubInfo[name],
                            type:pubInfo[type],
                            remoteAddress:pubInfo[addr]},
                subscriber:{clientName:subInfo[clientName],
                            name:subInfo[name],
                            type:subInfo[type],
                            remoteAddress:subInfo[addr]}}
    };
    console.log(msg);
    if (!this.shouldIgnore(msg)){
	    ignoreMessages.push(msg);
		ws.send(JSON.stringify(msg));
		if (!this.connections[pubUUID]){
			this.connections[pubUUID] = {};
		}
		this.connections[pubUUID][subUUID] = connection;
		this.revConnections[connection.id] = {source:pubUUID, target:subUUID};
	} else {
		console.log("ignoring init action");
	}
	//connection.getOverlay("label").setLabel(connection.sourceId.substring(6) + "-" + connection.targetId.substring(6));
};	

myPlumb.detachConnection = function(e){
	console.log("detachConnection");
	console.log(e);
	var connection = e.connection;
	pubUUID = this.revConnections[connection.id].source;
	subUUID = this.revConnections[connection.id].target;
	// var pubInfo, subInfo, pubUUID, subUUID;
	// for (var i = 0; i < connection.endpoints.length; i++){
	// 	if (connection.endpoints[i].isSource){
	// 		pubInfo = connection.endpoints[i];
	// 	} else {
	// 		subInfo = connection.endpoints[i];
	// 	}
	// }
	// pubUUID = pubInfo.getParameter("uuid");
	// subUUID = subInfo.getParameter("uuid");
	pubInfo = pubUUID.split(sep).map(Unsafetify);
	subInfo = subUUID.split(sep).map(Unsafetify);
	var clientName = 0,addr = 1, type = 2, name = 3;

	var msg = {
        route:{type:'remove',
                publisher:{clientName:pubInfo[clientName],
                            name:pubInfo[name],
                            type:pubInfo[type],
                            remoteAddress:pubInfo[addr]},
                subscriber:{clientName:subInfo[clientName],
                            name:subInfo[name],
                            type:subInfo[type],
                            remoteAddress:subInfo[addr]}}
    };
    console.log(msg);
    if (!this.shouldIgnore(msg)){
	    ignoreMessages.push(msg);
		ws.send(JSON.stringify(msg));
		this.connections[pubUUID][subUUID] = undefined;
		this.revConnections[connection.id] = undefined;
	} else {
		console.log("ignoring detach action");
	}
};

myPlumb.confirmDetachConnection = function(conn, originalEvent) {
	console.log("confirmDetachConnection");
	if (confirm("Delete connection from " + conn.sourceId + " to " + conn.targetId + "?"))
		jsPlumb.detach(conn);
};

//expecting Anchors:[{commType:'string'|'bool'|'int', source:true|false, label:<string>},...]
myPlumb.addEndpoints = function(toId, anchors) {
	var endpointList = {string:{source:this.sourceEndpointString,target:this.targetEndpointString},
						boolean:{source:this.sourceEndpointBool,target:this.targetEndpointBool},
						number:{source:this.sourceEndpointInt,target:this.targetEndpointInt}};

	var location = {0:"Left",1:"Center",2:"Right",target:"Top",source:"Bottom"};
	var num = {source:0,target:0};
	var endpointGroups = {source:this.allSourceEndpoints, target:this.allTargetEndpoints};

	var numAnchors = anchors.length;
	while (numAnchors--){
		var currAnchor = anchors[numAnchors];
		var type = (currAnchor.source ? "source" : "target");
		var currNumber = num[type]++;
		if (location[currNumber]){
			var anchorUUID = toId+sep+currAnchor.commType.Safetify()+sep+currAnchor.label.Safetify();
			var endpoint = jsPlumb.addEndpoint(toId, endpointList[currAnchor.commType][type], {anchor:location[type]+location[currNumber], parameters:{uuid:anchorUUID}});
			endpoint.setLabel({label:currAnchor.label, cssClass:type+"Label"/*, location:[0.5, 1.5*(currAnchor.source ? 1 : -1)]*/});
			endpointGroups[type].push(endpoint);
			this.endpoints[anchorUUID] = endpoint;
		}
	}
};

// this is the paint style for the connecting lines..
myPlumb.connectorPaintStyle = {
	lineWidth:2,
	strokeStyle:"#deea18",
	joinstyle:"round",
	outlineColor:"white"
};
myPlumb.programmaticConnectorPaintStyle = {
	lineWidth:1,
	strokeStyle:"#aaaaaa",
	joinstyle:"round",
	outlineColor:"white"
}
// .. and this is the hover style. 
myPlumb.connectorHoverStyle = {
	lineWidth:2,
	strokeStyle:"#2e2aF8"
};
myPlumb.activeEndpointPaintStyle = {
	fillStyle:"#ff00ff",
	radius:3
};
myPlumb.sourceEndpointBool = {
	endpoint:"Dot",
	paintStyle:{ fillStyle:"#225588",radius:3 },
	isSource:true,
	scope:'bool',
	connector:[ "Flowchart", { stub:[40, 60], gap:10 } ],								
	connectorStyle:myPlumb.connectorPaintStyle,
	hoverPaintStyle:myPlumb.connectorHoverStyle,
	connectorHoverStyle:myPlumb.connectorHoverStyle,
    dragOptions:{},
    maxConnections:-1
};
myPlumb.targetEndpointBool = {
	endpoint:"Dot",					
	paintStyle:{ fillStyle:"#225588",radius:3 },
	hoverPaintStyle:myPlumb.connectorHoverStyle,
	maxConnections:-1,
	scope:'bool',
	dropOptions:{ hoverClass:"hover", activeClass:"active" },
	isTarget:true
};
myPlumb.sourceEndpointInt = {
	endpoint:"Dot",
	paintStyle:{ fillStyle:"#882255",radius:3 },
	isSource:true,
	scope:'int',
	connector:[ "Flowchart", { stub:[40, 60], gap:10 } ],								
	connectorStyle:myPlumb.connectorPaintStyle,
	hoverPaintStyle:myPlumb.connectorHoverStyle,
	connectorHoverStyle:myPlumb.connectorHoverStyle,
    dragOptions:{},
    maxConnections:-1
};
myPlumb.targetEndpointInt = {
	endpoint:"Dot",					
	paintStyle:{ fillStyle:"#882255",radius:3 },
	hoverPaintStyle:myPlumb.connectorHoverStyle,
	maxConnections:-1,
	scope:'int',
	dropOptions:{ hoverClass:"hover", activeClass:"active" },
	isTarget:true
};
// the definition of source endpoints (the small blue ones)
myPlumb.sourceEndpointString = {
	endpoint:"Dot",
	paintStyle:{ fillStyle:"#558822",radius:3 },
	isSource:true,
	scope:'string',
	connector:[ "Flowchart", { stub:[40, 60], gap:10 } ],								
	connectorStyle:myPlumb.connectorPaintStyle,
	hoverPaintStyle:myPlumb.connectorHoverStyle,
	connectorHoverStyle:myPlumb.connectorHoverStyle,
    dragOptions:{},
    maxConnections:-1
};
// a source endpoint that sits at BottomCenter
//	bottomSource = jsPlumb.extend( { anchor:"BottomCenter" }, sourceEndpoint),
// the definition of target endpoints (will appear when the user drags a connection) 
myPlumb.targetEndpointString = {
	endpoint:"Dot",					
	paintStyle:{ fillStyle:"#558822",radius:3 },
	hoverPaintStyle:myPlumb.connectorHoverStyle,
	maxConnections:-1,
	scope:'string',
	dropOptions:{ hoverClass:"hover", activeClass:"active" },
	isTarget:true
};		

myPlumb.allSourceEndpoints = [];
myPlumb.allTargetEndpoints = [];


setupPlumbing = function() {

	jsPlumb.importDefaults({
		// default drag options
		DragOptions : { cursor: 'pointer', zIndex:2000 },
		// default to blue at one end and green at the other
		EndpointStyles : [{ fillStyle:'#225588' }, { fillStyle:'#558822' }],
		// blue endpoints 7 px; green endpoints 11.
		Endpoints : [ [ "Dot", {radius:3} ], [ "Dot", { radius:3 } ]],
		// the overlays to decorate each connection with.  note that the label overlay uses a function to generate the label text; in this
		// case it returns the 'labelText' member that we set on each connection in the 'init' method below.
		ConnectionOverlays : [
			/*[ "Arrow", { location:0.9 } ],
			[ "Label", { 
				location:0.1,
				id:"label",
				cssClass:"aLabel"
			}]*/
		],
		ConnectorZIndex:-1
	});			

	
	// listen for new connections; initialise them the same way we initialise the connections at startup.
	jsPlumb.bind("jsPlumbConnection", function(connInfo, originalEvent) { 
		myPlumb.init(connInfo.connection);
	});

	//
	// listen for clicks on connections, and offer to delete connections on click.
	//
	jsPlumb.bind("click", myPlumb.confirmDetachConnection.bind(myPlumb));	
	
	jsPlumb.bind("connectionDrag", function(connection) {
		console.log("connection " + connection.id + " is being dragged");
		console.log(connection);
	});
	
	jsPlumb.bind("connectionDragStop", function(connection) {
		console.log("connection " + connection.id + " was dragged");
	});

	jsPlumb.bind("connectionDetached", myPlumb.detachConnection.bind(myPlumb));


};
