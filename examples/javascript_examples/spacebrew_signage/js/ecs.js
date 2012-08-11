/*!
 * \namespace ECSjs
 * \brief An javascript library to connect to ECS installation.
 * <br />Copyright (C) 2012 LAB at Rockwell Group http://lab.rockwellgroup.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * 
 * @author      Brett Renfer
 * @modified    02/26/2012
 * @version     0.3.1.1
 */

var ECSjs = {};

/*! \class ECSjs::Connection
	\brief Creates a new ECS connection with host
*/

ECSjs.Connection = function( ){
	this.bConnected	 = false;
};


/*! \fn ECSjs::Connection::connect
 * \brief Setup ECS connection
 * \memberof ECSjs::Connection
 * \param role The ECS role that this application is fulfilling
 * \param host (optional) The host of the ecsc that this application should connect to. Defaults to 127.0.0.1. You must specify a host if you are connecting to a remote ECS server.
 * \param port (optional)  The port on the host of the ecsc that this application should connect to. Defaults to 7847 (ECS default). You must specify a port if you change the port your local or remote ECS server is running on.
 * 
 */

ECSjs.Connection.prototype.connect = function( role, host, port ) {
	this.role	= role;
	this.host 	= host || "127.0.0.1";
	this.port 	= port || 7847;
	
	this.socket = new WebSocket("ws://"+this.host+":"+this.port);
	this.socket._parent = this;
	this.socket.onmessage 	= this.onWSMessage.bind(this);
	this.socket.onopen 		= this.onConnectionOpened.bind(this);
	this.socket.onclose 	= this.onConnectionClosed.bind(this);
};

/*!
 * \fn ECSjs::Connection::sendMessage
 * \brief Send an ECS message
 * \memberof ECSjs::Connection
 * \param key The name of the route you are sending.
 * \param value the value you are sending
*/
ECSjs.Connection.prototype.sendMessage = function( key, value ) {
	if (!this.bConnected){
		if (console) console.log("Not connected!");
		return;
	}
	this.socket.send( "<route_update><configs><config><name>"+key+"</name><value>"+value+"</value></config></configs></route_update>" );
};

/*!
 * \fn ECSjs::Connection::onMessage
 * \brief Override this function in your app to receive ECS Messages.
 * \memberof ECSjs::Connection
 * \param key The name of the route you are receiving.
 * \param value the value you are receiving
*/

ECSjs.Connection.prototype.onMessage = function( name, value ) {
	if (console) console.log("got message "+name+":"+value);
};

/*!
 * \fn ECSjs::Connection::onConnect
 * \brief Override this function in your app to catch "connect" event from ECS.
 * \memberof ECSjs::Connection
*/

ECSjs.Connection.prototype.onConnect = function() {};

/*!
 * \fn ECSjs::Connection::onStart
 * \brief Override this function in your app to catch "start" event from ECS.
 * \memberof ECSjs::Connection
*/

ECSjs.Connection.prototype.onStart = function() {};

/*!
 * \fn ECSjs::Connection::onStop
 * \brief Override this function in your app to catch "stop" event from ECS.
 * \memberof ECSjs::Connection
*/

ECSjs.Connection.prototype.onStop = function() {};

/*!
 * \fn ECSjs::Connection::onFile
 * \brief Override this function in your app to receive ECS files.
 * \memberof ECSjs::Connection
 * \param key The name of the route you are receiving.
 * \param value the value you are receiving
*/

ECSjs.Connection.prototype.onFile = function( filepath ) {
};

/*!
 * \fn ECSjs::Connection::onConnectionOpened
 * \memberof ECSjs::Connection
 * \private
*/
ECSjs.Connection.prototype.onConnectionOpened = function() {
	this.bConnected = true;
	if (console) console.log("ECS connected");
	this.socket.send("<application_message><role>"+this.role+"</role></application_message>");
	this.onConnect();
};

/*!
 * \fn ECSjs::Connection::onConnectionClosed
 * \memberof ECSjs::Connection
 * \private
*/
ECSjs.Connection.prototype.onConnectionClosed = function() {
	this.bConnected = false;
};

/*!
 * \fn ECSjs::Connection::onWSMessage
 * \memberof ECSjs::Connection
 * \private
*/
ECSjs.Connection.prototype.onWSMessage = function( evt ) {
	var xml;	
	if (window.DOMParser){
	 	var parser=new DOMParser();
		xml = parser.parseFromString(evt.data, "text/xml");
	} else {
		// Internet Explorer 
		xml = new ActiveXObject("Microsoft.XMLDOM");
	  	xml.async=false;
	  	xml.loadXML(evt.data); 
	}
	
	if (evt.data.indexOf("route_update") >= 0) {
		var configs = xml.getElementsByTagName("configs")[0].childNodes;
        for (var i=0; i < configs.length; i++) {
        	var name 	= null;
        	var value 	= null;
        	var curConfig = configs[i];

        	// Config name
        	var n = curConfig.getElementsByTagName("name")[0];
        	name = n.childNodes[0].nodeValue;
        	
        	// Config value
        	var val = curConfig.getElementsByTagName("value")[0];
        	value = val.childNodes[0].nodeValue;
            
            // Invoke route update method if we have a complete name/value pair
            if (name != null && value != null) {
				this.onMessage( name, value );
            }
        }
	} else if (evt.data.indexOf("application_message") >= 0) {
		var action = xml.getElementsByTagName("action")[0];
		var a = action.childNodes[0].nodeValue;
		
		if (a == "start"){
			this.onStart();
		} else if (a == "stop"){
			this.onStop();
		}
	} else if (evt.data.indexOf("file_transfer") >= 0) {
		var action = xml.getElementsByTagName("filepath")[0];
		var fp = action.childNodes[0].nodeValue;

		// Invoke the file transfer method with the file path
		if (fp != null && !fp.equals("")) {
			this.onFile(fp);
		}
	}
};