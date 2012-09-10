var myPlumb = {};

myPlumb.endpoints = {};
myPlumb.connections = {};
myPlumb.revConnections = {};

// this is the paint style for the connecting lines..
myPlumb.connectorPaintStyle = {
	lineWidth:2,
	strokeStyle:"#aaaaaa",
	joinstyle:"round",
	outlineColor:"white",
	outlineWidth:0
};
// .. and this is the hover style. 
myPlumb.connectorHoverStyle = {
	lineWidth:2,
	strokeStyle:"#2e2aF8"
};
myPlumb.sourceEndpoint = {
	endpoint:"Blank",
	isSource:true,
	enabled:false,
	connector:"Straight",								
	connectorStyle:myPlumb.connectorPaintStyle,
	hoverPaintStyle:myPlumb.connectorHoverStyle,
	connectorHoverStyle:myPlumb.connectorHoverStyle,
    maxConnections:-1,
    anchor:"RightMiddle"
};
myPlumb.targetEndpoint = {
	endpoint:"Blank",
	hoverPaintStyle:myPlumb.connectorHoverStyle,
	maxConnections:-1,
	enabled:false,
	isTarget:true,
	anchor:"LeftMiddle"
};

myPlumb.allSourceEndpoints = [];
myPlumb.allTargetEndpoints = [];
myPlumb.connectionParams;


setupPlumbing = function() {

	jsPlumb.importDefaults({
		// blue endpoints 7 px; green endpoints 11.
		Endpoints : ["Blank", "Blank"],
		ConnectorZIndex:1,
		Anchors:["RightMiddle","LeftMiddle"],
		ConnectionsDetachable:false
	});
	myPlumb.connectionParams = {container:$("#connectionBin")};
};
