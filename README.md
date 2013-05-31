Spacebrew Server
================

A dynamically re-routable software toolkit for choreographing interactive spaces. Visit http://www.spacebrew.cc to learn more about spacebrew. On our site we feature a bunch of example apps and tutorials to help you get started. You'll also find a blog where we feature spacebrew projects and events.  
  
@version 		0.3.0  
@date			May 30, 2013  
@contributors 	Quin Kennedy, Brett Renfer, Josh Walton, Julio Terra   
  
Getting Started
---------------  
  
### 1. Install Dependencies  
* Download and install ![http://nodejs.org](Node.js)  
* Clone the repo from github  
* Install the dependencies using node packaged modules   
** `ws` websockets module  
** `forever-monitor` forever module  
  
### 2. Run the Server  
* Open terminal and navigate to the base directory of the spacebrew server  
* Run the server by using `node node_server_forever.js`  
  
`node_server_forever.js` vs `node_server.js`
The first of these two files runs node using the forever-monitor node utility. This utility relaunches the spacebrew server if it crashes and it saves logs of the standard output from the spacebrew server to log files, in the data/logs directory.

### 3. Connect Client Apps  
* Open the [http://spacebrew.github.io/spacebrew.js/spacebrew_button/index.html?server=localhost&name=button2](spacebrew_button example) - make sure that the `sever=` in the query string points to the appropriate host. Customize the `name=` element in the query string to change your apps name.  
* Open the admin [http://spacebrew.github.io/spacebrew/admin/admin.html?server=localhost](spacebrew_button example) in another browser window - again, make sure that the `sever=` in the query string points to the appropriate host.  
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
--pinginterval: the number of ms between pings (implies --ping, default 1000 [1 second])
--log (-l): sets logging to info level
--loglevel: set logging to info, debug, warn, error or critical - not fully supported yet
```

Here are a few examples of how to launch the app using command line options:
```
	node node_forever_server.js -p 9011 -t 1000 --pinginterval 1000
	node node_server.js --nopersist --loglevel warn
```

Other Services
-------------- 

### HTTP Link
Description to come

### Command Line Persistent Admin
Description to come


#### LICENSE
=============
The MIT License (MIT)
Copyright © 2012 LAB at Rockwell Group, http://www.rockwellgroup.com/lab

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
