spacebrew
=========

A dynamically re-routable software toolkit for choreographing interactive spaces.

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