Spacebrew Server
================

A dynamically re-routable software toolkit for choreographing interactive spaces. Visit http://www.spacebrew.cc to learn more about spacebrew. On our site we feature a bunch of example apps and tutorials to help you get started. You'll also find a blog where we feature spacebrew projects and events.  
  
@version: 		0.4.0  
@date:			April 10, 2014
@contributors: 		LAB at Rockwell Group, Quin Kennedy, Brett Renfer, Josh Walton, James Tichenor, Julio Terra   
  
Getting Started
---------------  
  
### 1. Install Dependencies  
* Download and install [Node.js](http://nodejs.org)  
* Clone the repo from github  
* Install the dependencies using node packaged modules   
    - `npm install`
  
### 2. Run the Server  
* Open terminal and navigate to the base directory of the spacebrew server  
* Run the server by using `node node_server_forever.js`  
  
`node_server_forever.js` vs `node_server.js`
The first of these two files runs node using the forever-monitor node utility. This utility relaunches the spacebrew server if it crashes and it saves logs of the standard output from the spacebrew server to log files in the data/logs directory.

### 3. Connect Client Apps  
* Open the [spacebrew_button example](http://spacebrew.github.io/spacebrew.js/spacebrew_button/index.html?server=localhost&name=button2) - make sure that the `server=` in the query string points to the appropriate host. Customize the `name=` element in the query string to change your apps name.  
* Open the [spacebrew admin interface](http://spacebrew.github.io/spacebrew/admin/admin.html?server=localhost) in another browser window - again, make sure that the `server=` in the query string points to the appropriate host.  
* Start connecting apps and routing data.   
  
Spacebrew Server Options
------------------------ 
Here is an overview of the command line options that the spacebrew server accepts:
```
--port (-p): set the port of the spacebrew server (default 9000)
--help (-h): print help text (which is what you are reading here)
--close (-c): force close clients that don't respond to pings
--ping: enable pinging of clients to track who is potentially disconnected (default)
--noping: opposite of --ping
--timeout (-t): minimum number of ms to wait for response pong before force closing (implies --close, default 10000 [10 seconds])
--persist: saves route configurations that are set via any admin interface
--nopersist: opposite of --persist
--log (-l): sets logging to info level
--loglevel: set logging to info, debug, warn, error
--pinginterval: the number of ms between pings (implies --ping, default 1000 [1 second])
```

Here are a few examples of how to launch the app using command line options:
```
	node node_forever_server.js -p 9011 -t 1000 --pinginterval 1000
	node node_server.js --nopersist --loglevel warn
```

Other Services
-------------- 

### HTTP Link

The HTTP Link (`http_link.js`) is a Node.js app which acts essentially as an HTTP <-> Websocket bridge for Spacebrew. Only `GET` requests are supported currently, so all commands are read from the query string. Responses are provided as JSON.

The HTTP Link allows you to use HTTP-only devices, such as the [Electric Imp](http://electricimp.com/), within the Spacebrew environment. 

1. Register a client by sending a `config` query string key which contains the same json structure as would be sent over Websockets 
    - `http://localhost:9092/?config={"config":{"name":"test","publish":{"messages":[{"name":"output","type":"string"},{"name":"out","type":"string"}]},"subscribe":{"messages":[{"name":"input","type":"string"}]}}}`
    - this is the human-readable version, don't forget to URL encode the data first
* The HTTP Link will respond with a `clientID` that you will use in the future to refer your client.
* You can send messages into the Spacebrew environment by sending a `publish` query string key which contains an array of messages you wish to publish
    - `http://localhost:9092/?clientID=0&publish=[{"message":{"clientName":"test","name":"output","type":"string","value":"hello!"}},{"message":{"clientName":"test","name":"output","type":"string","value":"good bye."}}]`
    - in this case we are sending 2 messages
* You can retrieve sent messages by including `poll=true` in the query string. This will return an array of all messages that have been received by the HTTP Link for your client since the last poll:
    - `http://localhost:9092/?clientID=0&poll=true`
* By default, only one message is queued per subscriber. If you wish to queue more, you can send a `bufferSize` along with your subscriber specifications
    - `http://localhost:9092/?clientID=0&config={"config":{"name":"test","publish":{"messages":[{"name":"output","type":"string"},{"name":"out","type":"string"}]},"subscribe":{"messages":[{"name":"input","type":"string","bufferSize":3}]}}}`
    - this example also shows how you can send a config update
* By default the HTTP Link will remove your client after 5 minutes if there is no queries associated with it. You can change this at any time by specifying a custom `timeout` in seconds
    - `http://localhost:9092/?clientID=0&poll=true&timeout=3600`
    - this example polls for input and also sets a 1-hour timeout

### Command Line Persistent Admin

The Persistent Admin (`node_persistent_admin.js`) is a command line Node.js app which makes sure certain specified publishers and subscribers always stay routed to one-another.

After starting the Persistent Admin (`node node_persistent_admin.js` in the command line/terminal) you can type `help` to get an overview of the various commands available. Basically you can:

* `ls` to get a list of currently-protected routes
* `add myClient,pubOne,theirClient,subscriberUno` to connect the `pubOne` publisher associated with client `myClient` to the `subscriberUno` subscriber associated with client `theirClient`
* `save` to save to disk
* `load` to load from disk (it will automatically load when starting up)
* `remove 0` to remove the zero'th route from protection (when you list the routes via `ls`, the indices listed before each route are what should be used for the remove command)
* `exit` to quit the Persistent Admin
* the `add` command can also be used with regular expressions such as `add myClient,.*,theirClient,.*` to connect all publishers from `myClient` with all compatible subscribers in `theirClient`


=============
#### LICENSE
The MIT License (MIT)
Copyright © 2012 LAB at Rockwell Group, http://www.rockwellgroup.com/lab

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
