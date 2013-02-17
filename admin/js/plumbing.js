var myPlumb = {};

myPlumb.endpoints = {};
myPlumb.connections = {};
myPlumb.revConnections = {};

// this is the paint style for the connecting lines..
myPlumb.connectorPaintStyle = {
	lineWidth:2,
	strokeStyle:"#000000",// "#aaaaaa",
	joinstyle:"round",
	outlineColor:"white",
	outlineWidth:0
};
// .. and this is the hover style. 
myPlumb.connectorHoverStyle = {
	lineWidth:2,
	strokeStyle:"#ff0",
	outlineColor:"#ccc"
};
myPlumb.endpointActiveStyle = {
	fillStyle:"magenta",
	outlineColor:"#000"
};
myPlumb.endpointPaintStyle = {
	fillStyle:"#000000"
};
myPlumb.endpointHoverStyle = {
	fillStyle:"#ff0",
	outlineColor:"#ccc"
}
myPlumb.sourceEndpoint = {
	isSource:true,
	enabled:false,
    anchor:"RightMiddle"
};
myPlumb.targetEndpoint = {
	enabled:false,
	isTarget:true,
	anchor:"LeftMiddle"
};

myPlumb.allSourceEndpoints = [];
myPlumb.allTargetEndpoints = [];
myPlumb.connectionParams;


setupPlumbing = function() {
	//jsPlumb.setRenderMode(jsPlumb.SVG);
	jsPlumb.importDefaults({
		// blue endpoints 7 px; green endpoints 11.
		Anchors:["RightMiddle","LeftMiddle"],
		ConnectionsDetachable:false,
		Connector:["Bezier",{curviness:50}],
		ConnectorZIndex:1,
		Endpoint : ["Image",{src:"img/node-open.png"}],//["Dot",{radius:7}],
		//Endpoints : ["Blank", "Blank"],
		EndpointStyle:myPlumb.endpointPaintStyle,
		EndpointHoverStyle:myPlumb.endpointHoverStyle,
		HoverPaintStyle:myPlumb.connectorHoverStyle,
		LogEnabled:false,
		MaxConnections:-1,
		PaintStyle:myPlumb.connectorPaintStyle,
		Container:endpointBin,
		//RenderMode:jsPlumb.SVG,
		setAutomaticRepaint:true
	});
	myPlumb.connectionParams = {container:$("#connectionBin")};
	triggerPaint();
};

//probably a horrible idea, but it keeps everything aligned
//might want to increase the interval timeout, but then it just looks choppy
triggerPaint = function(){
	jsPlumb.repaintEverything();
	window.requestAnimationFrame(triggerPaint);
};

window.requestAnimationFrame = (window.requestAnimationFrame 
                                || window.webkitRequestAnimationFrame 
                                || window.mozRequestAnimationFrame);