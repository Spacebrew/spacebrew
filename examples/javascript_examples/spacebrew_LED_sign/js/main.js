var socket;

var messageDiv;
var statusDiv;
var button;
var textField;
var initialMessage = "";

// input buddies
var message, check, color;

// spacebrew vars
var name, server;

var getQueryString = function (key){
	key = key.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	var regex = new RegExp("[\\?&]"+key+"=([^&#]*)");
	var qs = regex.exec(window.location.href);
	if(qs == null)
		return '';
	else
		return qs[1];
}

// spacebrew config
var myConfig;

var stringMessage 	= {
	"message":
	{
		"name":"text",
		"type":"string", 
		"value":"", 
		"clientName":""
	}
};
var intMessage	 	= {"message":{"name":"color","type":"number", "value":"0", "clientName":""}};
var boolMessage	 	= {"message":{"name":"party_mode","type":"boolean", "value":"0", "clientName":""}};

$(document).ready( function() {
	setupSocket();

	//setup message sending button
	message = document.getElementById("message");
	check = document.getElementById("check");
	color = document.getElementById("color");

	button = document.getElementById("button");

	// send the form when you press enter 
	// or when you press the button
	button.onclick = function(e){
		sendMessageForm();
	};

	$("#message").keyup(function(event){
    	if(event.keyCode == 13){
    		sendMessageForm()
    	}
    })

	initialMessage = getQueryString("message");
});

// send value from text input
function sendMessageForm(){
	stringMessage.message.value = message.value;
	intMessage.message.value 	= color.value;
	boolMessage.message.value	= check.checked ? 1 : 0;
	socket.send(JSON.stringify(stringMessage));
	socket.send(JSON.stringify(intMessage));
	socket.send(JSON.stringify(boolMessage));
	//message.value = "";
}

// setup web socket
function setupSocket(){
	name = getQueryString('name') || window.location.href; 
	server = getQueryString('server') || 'localhost';
	myConfig = {
	"config": {
	 "name": name,
	 "description": "Test out the LED sign",
	 "publish": {
	   "messages": [
	     {
	       "name": "text",
	       "type": "string",
	       "default": "None"
	     },
	     {
	       "name": "color",
	       "type": "number",
	       "default": "0"
	     },
	     {
	       "name": "party_mode",
	       "type": "boolean",
	       "default": "false"
	     },
	   ]
	 },
	 "subscribe": {
	   "messages": []
	 }
	}
	};

	stringMessage.message.clientName = intMessage.message.clientName = boolMessage.message.clientName = name;

	socket = new WebSocket("ws://"+server+":9000");
	
	// open
	try {
		socket.onopen = function() {
			var nameMsg = { "name": [
        		{"name": name}
       		]};

      		// send my config
   			socket.send(JSON.stringify(nameMsg));
      		socket.send(JSON.stringify(myConfig));

      		console.log("open")
      	} 

		// received message
		socket.onmessage =function got_packet(msg) {
			messageDiv.innerHTML = msg.data + "<br />" + messageDiv.innerHTML;
		}

		socket.onclose = function(){
			statusDiv.style.backgroundColor = "#ff4040";
			statusDiv.textContent = " websocket connection CLOSED ";
		}
	} catch(exception) {
		alert('<p>Error' + exception);  
	}
}