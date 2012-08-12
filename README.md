spacebrew
=========

A dynamically re-routable software toolkit for choreographing interactive spaces.

---- Getting Started ---------------------------------------------
* Clone the repo
* Install Node (installer at <a href="http://nodejs.org/">http://nodejs.org</a>)
* run the server by using 'node node_server.js' from the command line 
* Open the spacebrew_button example in a browser and append ?name=button to the end of the url and &server=locationOfServer i.e. - file:///Users/jwaltonAIR/Dropbox/PROGRAMMING/LABS_Spacebrew/spacebrew/examples/javascript_examples/spacebrew_button/index.html?name=button
* Open the admin in another browser window
* Start routing, have fun

---- General Notes -----------------------------------------------
* Work on refinement of json configs
* Get the server up and running on EC2 instance (or redhat?)

---- Server ------------------------------------------------------
* Create a good list of client connections, what is the Unique ID for a websocket?
* Look at how to package and distribute a node server easily.

---- Javascript Client -------------------------------------------
* Test mobile devices being able to connect correctly

---- Processing Client -------------------------------------------


---- Openframeworks Client ---------------------------------------
* Look at creating the first client using Brett's ofxlibwebsockets


---- Ideas of varying quality ------------------------------------
* scaffold admin interface data automatically
* use socket.io vs. other standards to support more (https://github.com/Gottox/socket.io-java-client https://github.com/uning/socket.io-client-cpp)
* add data logging automatically 
* Create a latching mechanism (When a connection is latched, the last message published is saved and automatically sent to any future subscribers that connect.)
* What about RabbitMQ? ZeroMQ? Socket.io at least? 