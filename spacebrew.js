/**
 * Spacebrew Server Module
 * -----------------------
 * 
 * This module holds the core functionality of the Spacebrew server. To run this module as 
 * standalone app you should use the node_server.js or node_server_forever.js script.
 *
 * @author: 	LAB at Rockwell Group, Quin Kennedy, Brett Renfer, Josh Walton, James Tichenor, Julio Terra
 * @filename: 	node_server.js
 * @date: 		May 31, 2013
 * @updated with version: 	0.4.0 
 *
 */

//dependencies
var path = require('path')
	, ws = require('ws')
    , logger = require('./logger')
    , spacebrew = exports
    , serveStatic = require('serve-static')
    , http = require('http')
    , finalhandler = require('finalhandler')
    , AJV = require('ajv')
    , fs = require('fs')
    , schema = require('./schema.json')
    ;

 
//create a new WebsocketServer
spacebrew.createServer = function( opts ){

    var expose = {};
    opts = opts || {};
    opts.port = opts.port || 9000;
    /** 
     * host can be set to limit which network interfaces to listen on.
     *   The default is 0.0.0.0 which will listen on all interfaces.
     *   Setting 'localhost' will only listen on the loopback interface
     */
    opts.host = opts.host || '0.0.0.0';
    opts.ping = opts.ping || true;
    opts.forceClose = opts.forceClose || false;
    opts.closeTimeout = opts.pingTimeout || 10000;
    opts.pingInterval = opts.pingInterval || 1000;
    logger.debugLevel = opts.logLevel || "warn";

    logger.log("info", "[createServer] log level set to " + logger.debugLevel);

    //setup validator
    ajv = AJV();
    validate = ajv.compile(schema);

    // create basic static folder
    var serve = serveStatic('admin');

    var server = http.createServer(
        function(req, res){
            var done = finalhandler(req, res)
            serve(req, res, done)
        }
    );

    server.listen(opts.port, opts.host);

    // allow websocket connections on the existing server.
    var wss = new ws.Server({
            server: server
        });

    expose.wss = wss;

    //read-only access to properties
    expose.get = function( key ){
        return opts[key];
    };

    /**
     * keeps a list of all the current websocket connections.
     * @type {Array}
     */
    var allconnections = [ ]; // list of currently connected clients (users) sockets

    /**
     * A list of websocket connections that have identified themselves as spacebrew Clients.
     * A Client identifies themselves by sending a config message as outlined in the examples.
     * @type {Array}
     */
    var trustedClients = []; // list of clients that have sent names
    // trustedClient = {subscribers:{<name>:{<type>:{name:____,type:____,publishers:[{client:<client_pointer>,publisher:<pub_pointer>}]}}}
    //                  publishers:{<name>:{<type>:{name:____,type:____,default:____,subscribers:[{client:<client_pointer>,subscriber:<sub_pointer>}]}}}}

    /**
     * A list of websocket connections that have identified themselves as Admins.
     * An Admin identifies themselves by sending an admin message as shown in the various Admin implementations.
     * @type {Array}
     */
    var adminConnections = [];


    /**
     * This creates an array of websocket messages to pass in bulk to new Admins
     * in order to catch the Admin up to speed on the current state of the Server.
     * TODO: cache this array of messages, or build it incrementally so we don't have to run
     * this expensive operation every time an Admin connects.
     * @return {Array} An array of messages to catch the new Admin up with the current state
     */
    var buildUpdateMessagesForAdmin = function(){
        var output = [];
        //re-create the 'config' messages
        for(var i = 0, end = trustedClients.length; i < end; i++){
            var currClient = trustedClients[i];
            var currMsg = {config:currClient.config};
            output.push(currMsg);
        }
        //now re-create the 'route' messages
        //we only need to build from one side, so we only look at publishers
        for(var i = 0, end = trustedClients.length; i < end; i++){
            var currClient = trustedClients[i];
            for (var publisherName in currClient.publishers){
                for (var type in currClient.publishers[publisherName]){
                    var publisherObj = {clientName:currClient.name,
                                        name:publisherName,
                                        type:type,
                                        remoteAddress:currClient.remoteAddress};
                    var publisher = currClient.publishers[publisherName][type];
                    for (var j = 0; j < publisher.subscribers.length; j++){
                        var subscriber = publisher.subscribers[j];
                        currMsg = {route:{type:'add',
                                            publisher:publisherObj,
                                            subscriber:{clientName:subscriber.client.name,
                                                        name:subscriber.subscriber.name,
                                                        type:subscriber.subscriber.type,
                                                        remoteAddress:subscriber.client.remoteAddress}}};
                        output.push(currMsg);
                    }
                }
            }
        }
        return output;
    };

    // WebSocket server

    /**
     * When a new client connects, we will add it to our list of connections
     * and setup the appropriate callbacks
     * @param  {obj} ws The ws object that contains all the connection info and provides callback hooks
     */
    wss.on('connection', function(ws) {
        logger.log("info", "[wss.onconnection] someone connected");

        var connection = ws;
        allconnections.push(ws);

        /**
         * We will handle all messages from connections here. This includes
         * admin, config, message, and routing messages for setting up, managing, and communicating
         * via spacebrew. This is the backbone of spacebrew.
         * @param  {obj} message The incoming message from an admin or client
         * @param  {obj} flags   Incoming flags re: the message (e.g. is it binary?)
         */
        ws.on('message', function(message, flags) {
            logger.log("info", "[wss.onmessage] new message received");

            var bValidMessage = false;
            if (message && !flags.binary) {
                logger.log("info", "[wss.onmessage] text message content: " + message);
                logger.log('info', "[wss.onmessage] source: " + getClientAddress(connection));
                // process WebSocket message
                try {
                    var tMsg = JSON.parse(message);
                } catch(err) {
                    logger.log("debug", "[wss.onmessage] error while parsing message as JSON");
                    return;
                }

                //validate message against schema
                if (!validate(tMsg)){
                    logger.log("warn", "[wss.onmessage] message did not pass JSON validation.");
                    for(var i = 0; i < validate.errors.length; i++){
                        logger.log('info', '[wss.onmessage] error ' + (i+1) + ': ' + validate.errors[i].message);
                    }
                    return;
                }

                try{
                	// handle client app configuration messages
                    if (tMsg['config']) {
                        bValidMessage = handleConfigMessage(connection, tMsg);
                    } 

                    // handle message messages (messages with routed data)
                    else if (tMsg['message']) {
                        bValidMessage = handleMessageMessage(connection, tMsg);
                    } 

                    // handle admin client messages
                    else if (tMsg['admin']) {
                        connection.spacebrew_is_admin = true;

                        // check if admin does not want to receive 'message' messages
                        connection.no_msgs = tMsg.no_msgs ? true : false;

                        // send admin the current state of the all connections
                        connection.send(JSON.stringify(buildUpdateMessagesForAdmin()));
                        adminConnections.push(connection);
                        bValidMessage = true;
                    } 

                    // handle route add/remove messages
                    else if (tMsg['route']){
                        bValidMessage = handleRouteMessage(connection, tMsg);
                    } 

                    // print to console if message not recognized
                    else {
                        logger.log("warn",  "[wss.onmessage] unrecognized message type. ", tMsg);
                    }

                    // if message was valide then send to admin
                    if (bValidMessage){
                        sendToAdmins(tMsg);
                    } 

                } catch (err){
                    logger.log("warn", "[wss.onmessage] ERROR on line <" + err.lineNumber + "> while processing message");
                    logger.log("warn", err.stack);
                }
            
            // this is a binary message
            } else {
                // for now:
                //  description follows format described here: https://tools.ietf.org/html/rfc5234
                //  inspired by WS protocol
                //  
                //       0                   1                   2                   3
                //       0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
                //      +---------------+-------------------------------+---------------+
                //      |  JSON len     |   Extended JSON length        |Extended JSON  |
                //      |      (8)      |            (16/32)            | length cont.  |
                //      |               |  (if JSON len == 254 or 255)  | (if JSON      |
                //      |               |                               | len == 255)   |
                //      +---------------+-----------------------------------------------+
                //      |Extended JSON  |                  JSON Data                    |
                //      | length cont.  |               (length variable)               |
                //      | (if JSON      |                                               |
                //      | len == 255)   |                                               |
                //      +---------------+-----------------------------------------------+
                //      |          Binary Data (remainder of packet payload)            |
                //      +---------------------------------------------------------------+
                //      
                if (message instanceof ArrayBuffer) {
                    message = new Buffer( new Uint8Array(message) );
                }

                if (message instanceof Buffer) {
                    logger.log("info", "[wss.onmessage] Binary message received (NodeJS/Buffer)");

                    //TODO: what concerns me is that the ws module does not explicitly guarantee
                    //  in its documentation that message.length is actually the message length 
                    //  (the Buffer documentation says .length is the size of the buffer, 
                    //  not necessarily the size of its contents)
                    if ( message.length > 0 ){
                        var jsonLength = message.readUInt8(0);
                        var jsonStartIndex = 1;
                        if (jsonLength == 254){
                            if (message.length > 3){
                                jsonLength = message.readUInt16BE(1);
                                jsonStartIndex = 3;
                            } else {
                                logger.log("error", "[wss.onmessage] message of incorrect format");
                                return;
                            }
                        } else if (jsonLength == 255){
                            if (message.length > 5){
                                jsonLength = message.readUInt32BE(1);
                                jsonStartIndex = 5;
                            } else {
                                logger.log("error", "[wss.onmessage] message of incorrect format");
                                return;
                            }
                        }

                        if (jsonLength > 0 ){
                            if (message.length >= jsonStartIndex + jsonLength) {
                                try {
                                    var json  = JSON.parse( message.slice(jsonStartIndex, jsonStartIndex + jsonLength ).toString());
                                } catch ( err ){
                                    logger.log("error", "[wss.onmessage] Error parsing JSON from binary packet. Discarding");
                                    return;
                                }

                                bValidMessage = handleBinaryMessage(connection, json, message.slice(jsonStartIndex + jsonLength) );
                            } else {
                                logger.log("error", "[wss.onmessage] message of incorrect format");
                                return;
                            }
                        }
                    }

                } else {
                    logger.log("warn", "[wss.onmessage] Binary message received in unknown format");
                }
            }
        });

        /**
         * When a websocket connection is closed, we want to cleanup the Client
         * (including all publishers and subscribers) associated with that connection,
         * as well as any routes that Client was involved in. Finally we will remove the
         * Client or Admin from their respective connection list and remove the connection
         * from allconnections. While a Client is being cleaned up, all route remove messages are sent
         * to the Admins and finally a Client remove message is sent to the Admins.
         * @param  {obj} ws The object containing information about the connection that is being closed
         */
        ws.on('close', function(ws) {
            connection.spacebrew_was_closed = true;
            cleanupClosedConnections();
        });

        ws.on("pong", function(e){
            connection.spacebrew_pong_validated = true;
        });

        ws.on("error", function(e) {
            logger.log("error", "[wss.onerror] ERROR with websocket server " + e);
            try{
                logger.log("error", arguments);
                logger.log("error", JSON.stringify(e));
            } catch (ne){
                logger.log("error", keys(e));
            }
        });
    });

    /**
     * A helper function to handle routing messages from a publisher to the appropriate subscribers.
     * @param  {ws Connection Obj} connection The connection that the message came in on
     * @param  {json} tMsg The message from the publisher which should be forwarded to its subscribers
     * @return {boolean}      True iff the message comes from a publisher that exists
     */
    var handleMessageMessage = function(connection, tMsg){
    	var pubClient = undefined
    		, bValidMessage = false
    		, pub = undefined
    		, sub = undefined
    		, toSend = {}
    		;

        // make sure that this connection is associated to at least one client
        if (!connection.spacebrew_client_list){
            logger.log("info", "[handleMessageMessage] this connection has no registered clients");
            return false;
        }

        // check whether the client that sent the message is associated to the connection where the 
        //  	message was received
        if (!(pubClient = connection.spacebrew_client_list[tMsg.message.clientName])){
            logger.log("info",  "[handleMessageMessage] the client: " + tMsg.message.clientName + 
            						" does not belong to this connection");
            return false;
        }

        //high level thoughts:
        //  Change to [<type>][<pub/sub Name>] to access publishers and subscribers for a client.
        //    This should help speed up searching since the first level will usually be 3 bins max
        //    and then the second level has many branches instead of the first level having all
        //    the branches and the second level having one branch. Keep in mind that we should support
        //    user-defined types beyond String, Boolean, Range. Is it quicker to rely on the hash-map
        //    to quickly find elements or should be implement our own binary search? 
        //    (sounds like we are going too deep) But maybe we could implement a priority queue, publishers
        //    that publish often are more likely to publish.

        //add the remote address to the message 
        tMsg['message'].remoteAddress = getClientAddress(connection);

        // if publishing client does have the appropriate publisher then continue processing the message
        if (pub = pubClient.publishers[tMsg.message.name]) {

            // if publisher is of the appropriate type then send message to all subscribers
            if (pub = pub[tMsg.message.type]) {
                bValidMessage = true;

                for(var j = pub.subscribers.length - 1; j >= 0; j--){
                    sub = pub.subscribers[j];

                    // try to send the message but catch error so the server won't crash due to issues
                    try{
                    	toSend['message'] = {
                            	'name': sub.subscriber.name,
                            	'type': tMsg.message.type,
                            	'value': tMsg.message.value,
                                'clientName': sub.client.name
                        }

                        sub.client.connection.send(JSON.stringify(toSend));
                        logger.log("info", "[handleMessageMessage] message sent to: '" + sub.client.name + "' msg: " + JSON.stringify(toSend)); 

                    } catch(err){
                        logger.log("debug", "[handleMessageMessage] ERROR sending message to client " + 
                        						sub.client.name + ", on subscriber " +
                        						sub.subscriber.name + " error message " + err );
                    }
                }
            }

        	// if publisher's type does not match then abort
        	else {
                logger.log("info", "[handleMessageMessage] an un-registered publisher type: " + tMsg.message.type + " with name: " + tMsg.message.name);
                return false;
            } 
        }

        // if publishing client does not have the appropriate publisher then abort
	    else {
            logger.log("info", "[handleMessageMessage] an un-registered publisher name: " + tMsg.message.name);
            return false;
        } 

        return bValidMessage;
    };

    /**
     * A helper function to handle routing messages from a publisher to the appropriate subscribers.
     * @param  {ws Connection Obj} connection The connection that the message came in on
     * @param  {json} tMsg The message from the publisher which should be forwarded to its subscribers
     * @param  {Buffer} Binary data to be sent to subscriber
     * @return {boolean}      True iff the message comes from a publisher that exists
     */
    var handleBinaryMessage = function(connection, tMsg, binaryData){
        var pubClient = undefined
            , bValidMessage = false
            , pub = undefined
            , sub = undefined
            , toSend = {}
            ;

        // make sure that this connection is associated to at least one client
        if (!connection.spacebrew_client_list){
            logger.log("info", "[handleBinaryMessage] this connection has no registered clients");
            return false;
        }

        // check whether the client that sent the message is associated to the connection where the 
        //      message was received
        if (!(pubClient = connection.spacebrew_client_list[tMsg.message.clientName])){
            logger.log("info",  "[handleBinaryMessage] the client: " + tMsg.message.clientName + 
                                    " does not belong to this connection");
            return false;
        }

        //high level thoughts ( are below \/ )

        //add the remote address to the message 
        tMsg['message'].remoteAddress = getClientAddress(connection);

        // if publishing client does have the appropriate publisher then continue processing the message
        if (pub = pubClient.publishers[tMsg.message.name]) {

            // if publisher is of the appropriate type then send message to all subscribers
            if (pub = pub[tMsg.message.type]) {
                bValidMessage = true;

                for(var j = pub.subscribers.length - 1; j >= 0; j--){
                    sub = pub.subscribers[j];

                    // try to send the message but catch error so the server won't crash due to issues
                    try{
                        toSend['message'] = {
                                'name': sub.subscriber.name,
                                'type': tMsg.message.type,
                                'value': tMsg.message.value,
                                'clientName': sub.client.name
                        }

                        var jsonString = JSON.stringify(toSend);
                        var jsonByteLength = Buffer.byteLength(jsonString);
                        var numBytesForJsonLength = (jsonByteLength > 0xFFFF ? 5 : (jsonByteLength >= 254 ? 3 : 1));
                        var bufferSize = binaryData.length + jsonByteLength + numBytesForJsonLength;
                        var newBuffer = new Buffer( bufferSize );
                        logger.log("info", "[handleBinaryMessage] created new buffer of size "+newBuffer.length );
                        if (numBytesForJsonLength == 5){
                            newBuffer.writeUInt8(255, 0);
                            newBuffer.writeUInt32BE(jsonByteLength, 1);
                        } else if (numBytesForJsonLength == 3){
                            newBuffer.writeUInt8(254, 0);
                            newBuffer.writeUInt16BE(jsonByteLength, 1);
                        } else {
                            newBuffer.writeUInt8(jsonByteLength, 0);
                        }
                        newBuffer.write(jsonString, numBytesForJsonLength);
                        binaryData.copy(newBuffer, numBytesForJsonLength + jsonByteLength );

                        sub.client.connection.send(newBuffer, {binary: true});
                        logger.log("info", "[handleBinaryMessage] message sent to: '" + sub.client.name + "' msg: " + JSON.stringify(toSend)); 

                    } catch(err){
                        logger.log("debug", "[handleBinaryMessage] ERROR sending message to client " + 
                                                sub.client.name + ", on subscriber " +
                                                sub.subscriber.name + " error message " + err );
                    }
                }
            }

            // if publisher's type does not match then abort
            else {
                logger.log("info", "[handleBinaryMessage] an un-registered publisher type: " + tMsg.message.type + " with name: " + tMsg.message.name);
                return false;
            } 
        }

        // if publishing client does not have the appropriate publisher then abort
        else {
            logger.log("info", "[handleBinaryMessage] an un-registered publisher name: " + tMsg.message.name);
            return false;
        } 

        return bValidMessage;
    };

    /**
     * A helper function to handle adding and removing routes. This will update the neccessary
     * data structures
     * @param  {json} tMsg The message from an Admin specifying whether to add or remove a route
     * @return {boolean}      True iff the route message was valid and changed the state of the server.
     */
    var handleRouteMessage = function(connection, tMsg){
        //Check that the message came from an Admin connection
        //  note that 'connection' will be undefined for simulated route messages
        //  from within the Server
        if (connection && !connection.spacebrew_is_admin){
            return false;
        }
        //expected message format:
        //{route:{type:<add/remove>,
        //        publisher:{clientName:_____,name:____,type:_____,remoteAddress:_____},
        //        subscriber:{clientName:____,name:____,type:____,remoteAddress:____}}}
        var bValidMessage = false;
        var pub = tMsg.route.publisher, sub = tMsg.route.subscriber;
        //ignore if types do not match
        if (pub.type === sub.type){
            var pubEntry, subEntry, pubClient, subClient;
            //find the appropriate entry in trustedClients
            var tcLength = trustedClients.length;
            for(var i = 0; i < tcLength && (pubEntry === undefined || subEntry === undefined); i++){
                if (trustedClients[i].name === pub.clientName 
                    && trustedClients[i].remoteAddress === pub.remoteAddress){
                    pubClient = trustedClients[i];
                    if (pubClient.publishers[pub.name] == undefined){
                        logger.log("warn", "[handleRouteMessage] client does not have publisher "+pub.name);
                    } else if (pubClient.publishers[pub.name][pub.type] == undefined){
                        logger.log("warn", "[handleRouteMessage] publisher is not of type "+pub.type);
                    } else {
                        pubEntry = pubClient.publishers[pub.name][pub.type];
                    }
                }
                if (trustedClients[i].name === sub.clientName
                    && trustedClients[i].remoteAddress === sub.remoteAddress){
                    subClient = trustedClients[i];
                    if (subClient.subscribers[sub.name] == undefined){
                        logger.log("warn", "[handleRouteMessage] client does not have subscriber "+sub.name);
                    } else if (subClient.subscribers[sub.name][sub.type] == undefined){
                        logger.log("warn", "[handleRouteMessage] subscriber is not of type "+sub.type);
                    } else {
                        subEntry = subClient.subscribers[sub.name][sub.type];
                    }
                }
            }
            //if we have found a matching publisher and subscriber, 
            //handle the adding or deleting of references
            //and notify the calling function that they can forward the message
            //to all the admins
            if (pubEntry && subEntry){
                if (tMsg.route.type == "add"){
                    //If the designated publisher and subscriber are already routed together
                    //then ignore this message
                    if (areRoutedTogether(pubClient, pubEntry, subClient, subEntry)){
                        return false;
                    }
                    //if not, route them
                    bValidMessage = true;
                    pubEntry.subscribers.push({client:subClient,subscriber:subEntry});
                    subEntry.publishers.push({client:pubClient,publisher:pubEntry});
                } else if (tMsg.route.type == "remove"){
                    //If the designated publisher and subscriber are NOT routed together currently
                    //then ignore this message
                    if (!areRoutedTogether(pubClient, pubEntry, subClient, subEntry)){
                        return false;
                    }
                    //if they are currently routed, then break the connection
                    bValidMessage = true;
                    var entry;
                    var items = [{'first':subEntry, 'second':pubEntry.subscribers, 'third':'subscriber'},
                                 {'first':pubEntry, 'second':subEntry.publishers, 'third':'publisher'}];
                    for (var j = 0; j < items.length; j++){
                        var item = items[j];
                        for(var i = item['second'].length - 1; i >= 0; i--){
                            entry = item['second'][i];
                            if (entry[item['third']] === item['first']){
                                item['second'].splice(i, 1);
                            }
                        }
                    }
                } else {
                    bValidMessage = false;
                }
            }
        }
        return bValidMessage;
    };

    /**
     * logs all the currently trusted clients by name for debugging purposes
     */
    var printAllTrustedClients = function(){
        logger.log("info", "[printAllTrustedClients] total number of trustedClients: " + trustedClients.length);

        for (var i=0; i<trustedClients.length; i++) {
            logger.log("info", "\t client name: " + trustedClients[i]['name'] + ", ip address: " + trustedClients[i]['remoteAddress']);
        }
    };

    var getClientAddress = function(connection){
        try{
            var out = {};
            connection._socket._handle.getpeername(out);
            return out.address; //connection.upgradeReq.headers.host;
        } catch (e){}
        logger.log("info", "[printAllTrustedClients] unable to access remote address");
        return "unknown";
    };

    /**
     * A helper function used to parse config messages from Clients.
     * @param  {ws Connection Obj} connection The connection that the message came in on
     * @param  {json} tMsg       The config message from the Client
     * @return {boolean}            True iff the Client you are trying to config does not already exist
     */
    var handleConfigMessage = function(connection, tMsg){
        var bValidMessage = false
        	, trustedClient = undefined
        	, msgName = tMsg['config']['name']
        	, msgAddress = getClientAddress(connection)
        	;

        // check if websocket client already has registered client app with same name
        if (connection.spacebrew_client_list && 
        	connection.spacebrew_client_list[msgName]){

            // if so, then set trustedClient to existing client
            trustedClient = connection.spacebrew_client_list[msgName];
            logger.log("info", "[handleConfigMessage] client already exists and will be updated ");
        } 

        // otherwise, check that the name and remote address pair is not already taken
        else {

            for (var i = trustedClients.length - 1; i >= 0; i--) {

            	// if client exists with name and remote address pair
                if (trustedClients[i]['name'] === msgName &&
                    trustedClients[i]['remoteAddress'] === msgAddress){

                    // ignore config message if client connection has been verified
                    if (trustedClients[i].connection.spacebrew_pong_validated){
                        logger.log("info", "[handleConfigMessage] verified client exists with same name and address -- denying new connection");

                        // stop processing config message
                        return false;
                    } 

                    // otherwise, remove old unverified client to make space for new client
                    else {
                        logger.log("info", "[handleConfigMessage] unverified client exists with same name and address -- removing unverified client");

                        // remove all routes associated to old client
                        removeRoutesInvolvingClient(trustedClients[i]);

                        // remove old client from all admins
                        sendToAdmins({remove:{name:trustedClients[i].name, remoteAddress:trustedClients[i].remoteAddress}});

                        //remove the old client from the list
                        trustedClients.splice(i, 1);
                    }
                }
            };
        }

        // if client doesn't already exist then initialize it
        if (!trustedClient){

            // if connection does not have a client list, then create it.
            if (!connection.spacebrew_client_list){
                connection.spacebrew_client_list = {};
            }

            trustedClient = {
                "name": msgName,
                "remoteAddress": msgAddress,
                "description": "",
                "connection": connection,
                "publishers": {},
                "subscribers": {},
                "options": {},
                "config": {}
            };

            // add client to trustedClients array
            trustedClients.push(trustedClient);

            // add client to websocket client list
            connection.spacebrew_client_list[msgName] = trustedClient;

            // print a list of all trusted clients (info logging level only)
            printAllTrustedClients();
        }

        // Now that we have the base data structure, we can update it to match the new
        // config message, regardless of whether or not this is a pre-existing client.

        bValidMessage = true;

        // add remote address to the message which will be forwarded to admins
        tMsg['config'].remoteAddress = trustedClient.remoteAddress;

        // configure the trustedClient object with config message and description
        trustedClient.config = tMsg['config'];
        trustedClient.description = tMsg['config']['description'];

        // process subscribers
        var tSubs = [];
        if (tMsg.config.subscribe && tMsg.config.subscribe.messages){
            // copy data from config so that we don't corrupt original config message
            for (var i = tMsg.config.subscribe.messages.length - 1; i >= 0; i--) {
                var currSub = tMsg.config.subscribe.messages[i];
                currSub.type = currSub.type.toLowerCase();
                tSubs.push({name:currSub.name, type:currSub.type, default:currSub.default});
            };
        } else {
            tMsg.config['subscribe'] = {};
            tMsg.config.subscribe['messages'] = [];
        }

        // process publishers
        var tPubs = [];
        if (tMsg.config.publish && tMsg.config.publish.messages){
            // copy data from config so that we don't corrupt original config message
            for (var i = tMsg.config.publish.messages.length - 1; i >= 0; i--) {
                var currPub = tMsg.config.publish.messages[i];
                currPub.type = currPub.type.toLowerCase();
                tPubs.push({name:currPub.name, type:currPub.type, default:currPub.default});
            };
        } else {
            tMsg.config['publish'] = {};
            tMsg.config.publish['messages'] = [];
        }

        // process client options
        if (tMsg.config.options){
        	// update supported options only (present in trustedClient object)
            for (var option in trustedClient.options) {
            	if (tMsg.config.options[option]) {
            		trustedClient.options[option] = tMsg.config.options[option];
            	}
            };
        } 

        /////////////////////////////////////////
        //we are storing in a structure
        // trustedClient = {subscribers:{<name>:{<type>:{name:____,type:____,publishers:[{client:<client_pointer>,publisher:<pub_pointer>}]}}}
        //                  publishers:{<name>:{<type>:{name:____,type:____,default:____,subscribers:[{client:<client_pointer>,subscriber:<sub_pointer>}]}}}}
        //so you need to access them by trustedClients[i][<sub_or_pub>][<name>][<type>]
        //
        //The 'hash' variable is used to keep a list of publishers or subscribers defined by this config
        //message. After we add all the new or updated publishers and subscribers to our internal data structures, 
        //we can check against the 'hash' variable and remove any now undefined publishers and subscribers.
        var items = [{'first':tSubs, 'second':trustedClient.subscribers, 'third':'publishers', 'fourth':'subscriber', 'fifth':'publisher'}, 
                     {'first':tPubs, 'second':trustedClient.publishers, 'third':'subscribers', 'fourth':'publisher', 'fifth':'subscriber'}];

        for (var j = 0; j<items.length; j++){
            var item = items[j];
            var hash = {};
            //add new subscribers/publishers to hash
            for (var i=0; i<item['first'].length; i++) {
                if (!hash[item['first'][i].name]){
                    hash[item['first'][i].name] = {};
                }
                hash[item['first'][i].name][item['first'][i].type] = 'exists';
                if (!item['second'][item['first'][i].name]){
                    item['second'][item['first'][i].name] = {};
                }
                if (!item['second'][item['first'][i].name][item['first'][i].type]){
                    item['first'][i][item['third']] = [];
                    item['second'][item['first'][i].name][item['first'][i].type] = item['first'][i];
                }
            }

            //remove stale subscribers/publishers from our data structures
            //TODO:break any routes associated with now undefined publishers and subscribers
            for (var itemName in item['second']){
                if (hash[itemName] === undefined){
                    //remove each route involving these items
                    for (var itemType in item['second'][itemName]){
                        var currBase = item['second'][itemName][itemType];
                        removeRoutesInvolving(currBase, trustedClient);
                    }
                    delete item['second'][itemName];
                } else {
                    for (var itemType in item['second'][itemName]){
                        if (hash[itemName][itemType] === undefined){
                            removeRoutesInvolving(item['second'][itemName][itemType], trustedClient);
                            delete item['second'][itemName][itemType];
                        }
                    }
                }
            }
        }

        return bValidMessage;
    };

    /**
     * This will remove all the routes involving the specified item (either publisher or subscriber)
     * @param  {Item Obj} item   The item (either publisher or subscriber) to remove all routes to/from
     * @param  {Client Obj} client The client that provides this publisher or subscriber to spacebrew
     */
    var removeRoutesInvolving = function(item, client){
        var currBase = item;
        var isPublisher = (currBase.publishers === undefined);
        var myType = (isPublisher ? 'publisher' : 'subscriber'),
            otherType = (isPublisher ? 'subscriber' : 'publisher'),
            otherTypePlural = (isPublisher ? 'subscribers' : 'publishers');
        var toSend = [];//an array of messages to send to admins to tell them about the route updates

        //for each item that the passed-in item is connected to, 
        //create, process, and send a route remove connection
        for (var i = currBase[otherTypePlural].length - 1; i >= 0; i--) {
            var currLeaf = currBase[otherTypePlural][i];
            var messageContent = {
					            	type:'remove'
					            	, client_disconnect: true  // used to identify message as cleanup message
					            };
            messageContent[otherType] = {clientName:currLeaf.client.name,
                                            name:currLeaf[otherType].name,
                                            type:currLeaf[otherType].type,
                                            remoteAddress:currLeaf.client.remoteAddress};
            messageContent[myType] = {clientName:client.name,
                                            name:currBase.name,
                                            type:currBase.type,
                                            remoteAddress:client.remoteAddress};
            logger.log("info", "[removeRoutesInvolving] removing route internally ################");
            logger.log("info", JSON.stringify(messageContent));
            //Here I use the standard 'route removing' function to actually 
            //clean up all the data structures related to this route.
            if (handleRouteMessage(undefined, {route:messageContent})){
                logger.log("info", "[removeRoutesInvolving] successfully removed route, telling admins");
                toSend.push({route:messageContent});
            }
        };

        //bulk update admins at the end
        //OPTION: return this array and have the calling function deal with notifying the
        //admins, this will allow all route remove messages for an entire client to be sent together
        //instead of just tall route remove messages for a particular publisher or subscriber
        if (toSend.length > 0){
            sendToAdmins(toSend);
        }
    };

    /**
     * This will remove all the routes involving the specified client
     * @param  {Client Obj} client The client to remove all routes to/from
     */
    var removeRoutesInvolvingClient = function(client){
        //for each publisher
        //for each subscriber to that publisher
        //remove route
        //for each subscriber
        //for each publisher to that subscriber
        //remove route
        var items = [{'first':client.publishers, 'second':'subscribers', 'third':'subscriber', 'fourth':'publisher'},
                     {'first':client.subscribers, 'second':'publishers', 'third':'publisher', 'fourth':'subscriber'}];
        for (var k = 0; k < items.length; k++){
            var item = items[k];
            for (var itemName in item['first']){
                for (var itemType in item['first'][itemName]){
                    var currBase = item['first'][itemName][itemType];
                    //TODO: change this to return list of messages instead of sending messages itself
                    //and add note about why (hint: persistent admin)
                    removeRoutesInvolving(currBase, client);
                    //var numItems = currBase[item['second']].length;
                    // while(numItems--){
                    //     var currLeaf = currBase[item['second']][numItems];
                    //     var messageContent = {type:'remove'};
                    //     messageContent[item['third']] = {clientName:currLeaf.client.name,
                    //                                     name:currLeaf[item['third']].name,
                    //                                     type:currLeaf[item['third']].type,
                    //                                     remoteAddress:currLeaf.client.remoteAddress};
                    //     messageContent[item['fourth']] = {clientName:trustedClients[i].name,
                    //                                     name:currBase.name,
                    //                                     type:currBase.type,
                    //                                     remoteAddress:trustedClients[i].remoteAddress};
                    //     //Here I use the standard 'route removing' function to actually 
                    //     //clean up all the data structures related to this route.
                    //     if (handleRouteMessage(undefined, {route:messageContent})){
                    //         //TODO: add the route remove message to an array,
                    //         //and send that array in bulk to all the admins at the end
                    //         sendToAdmins({route:messageContent});
                    //     }
                    // }
                }
            }
        }
    }

    /**
     * Checks to see if the specified publisher and subscriber are already routed together
     * @param  {Client Obj} pubClient The Client object from the trustedClients array that contains this publisher
     * @param  {Pub Obj} pubEntry  The publisher entry that is the specific publisher from pubClient
     * @param  {Client Obj} subClient The Client object from the trustedClients array that contains this subscriber
     * @param  {Sub Obj} subEntry  The subscriber entry that is the specific subscriber from subClient
     * @return {boolean}           True iff the publisher and subscriber are routed together
     */
    var areRoutedTogether = function(pubClient, pubEntry, subClient, subEntry){
        var numSubscribers = pubEntry.subscribers.length;
        while(numSubscribers--){
            var currSub = pubEntry.subscribers[numSubscribers];//{client:{},subscriber:{}}
            if (currSub.subscriber.type === subEntry.type &&
                currSub.subscriber.name === subEntry.name &&
                currSub.client.name === subClient.name &&
                currSub.client.remoteAddress === subClient.remoteAddress){
                //the pub/sub are routed together
                return true;
            }
        }
        //we did not encounter a matching subscriber that is routed to from the specified publisher
        return false;
    };

    /**
     * A helper function to send the specified message to all registered Admins.
     * @param  {json} json The message to forward to all Admins
     */
    var sendToAdmins = function(json){
        //This is an enum designed to specify more generally who the message is targetted toward
        //the absense of "targetType" implies "targetType":"client"
        json.targetType = "admin";
        var toSend = JSON.stringify(json);
        for(var i = adminConnections.length - 1; i >= 0; i--){
        	// check if connection is still open before attempting to send messages
        	if (adminConnections[i].readyState == 1) {
	        	try {

                    ////////////////////////////////////////////////////////
                    // ---- NEW FUNCTIONALITY FOR ADMINS TO NOT GET MESSAGES
	        		// if admin does not want to receive messages and this is a message, then skip
	        		if( adminConnections[i].no_msgs && json['message'] ) continue;
	        		// otherwise send message to admin
		            else adminConnections[i].send(toSend);    		
		            ///////////////////////////////////////////////////////

		            // OLD APPROACH
		            // adminConnections[i].send(toSend);    		
	        	} catch (e) {
	        		logger.log("debug", "[sendToAdmins] ERROR: WebSocket library error sending message to admin at index " + i);
	        		logger.log("debug", e);
	        	}        		
        	}
        }
    };

    var cleanupClosedConnections = function(){
        // close user connection
        logger.log("info", "close");
        var removed = [];

        for(var i = 0; i < trustedClients.length;){
            //logger.log("info", trustedClients);
            if (trustedClients[i].connection.spacebrew_was_closed){
                removeRoutesInvolvingClient(trustedClients[i]);
                removed.push({name:trustedClients[i].name, remoteAddress:trustedClients[i].remoteAddress});
                trustedClients.splice(i, 1);
            } else {
                i++;
            }
        }

        //remove Admins
        //logger.log("info", "There are admins: "+ adminConnections.length);
        for(var i = 0; i < adminConnections.length;){
            if (adminConnections[i].spacebrew_was_closed){
                adminConnections.splice(i, 1);
            } else {
                i++;
            }
        }
        //remove connections
        for(var i = 0; i<allconnections.length;){
            if (allconnections[i].spacebrew_was_closed){
                allconnections.splice(i, 1);
            } else {
                i++;
            }
        }

        //tell the Admins about removed Clients
        //do this after any disconnected admins are removed.
        sendToAdmins({remove:removed});
    };

    /**
     * Periodically send ping messages to all clients, when they return the ping, we can mark them as active.
     */
    var pingAllClients = function(){
        for (var i = trustedClients.length - 1; i >= 0; i--) {
            var currConn = trustedClients[i].connection;
            try{
                if (currConn.spacebrew_pong_validated === undefined
                    || currConn.spacebrew_pong_validated === true){
                    currConn.spacebrew_pong_validated = false;
                    currConn.spacebrew_first_pong_sent = Date.now();
                    logger.log("info", "[pingAllClients] setting validated = false");
                } else if (opts.forceClose
                            && currConn.spacebrew_pong_validated === false
                            && (currConn.spacebrew_first_pong_sent + opts.closeTimeout) < Date.now()){
                    //10-second timeout
                    currConn.close();
                    //cleanupClosedConnections();
                    logger.log("info", "[pingAllClients] closed connection");
                    continue;
                }
                currConn.ping("ping");
            } catch(err){
                logger.log("warn", "[pingAllClients] CAN'T PING CLIENT, CONNECTION ALREADY CLOSED");
            }
        };
    }

    if (opts.ping){
        setInterval(pingAllClients, opts.pingInterval); //ping everyone every second to verify connections
    }
    return expose;

};
