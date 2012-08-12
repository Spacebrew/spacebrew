$(document).ready( function() {
	setup();
});

var ecs = new ECSjs.Connection();

//-------------------------------------------------------
function setup (){
	ecs.connect("webSender");
	
	// override default function to catch incoming messages + ECS connect notification
	ecs.onConnect = onConnect;
	ecs.onMessage = onMessage;
	
	// listen to the mouse
	window.addEventListener("mousedown", onMouseDown);
}

function onConnect (  ) {
	document.body.innerHTML += "<br /><h2>ECS Connected!</h2>";
}


function onMessage ( key, value ) {
	if (console){
		console.log("Caught message:{ key: -"+key+", value: "+value+"}");
	}
}

function onMouseDown (evt){
	ecs.sendMessage("packet", 255);
}