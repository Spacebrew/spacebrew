************************************************
 ABOUT 
************************************************
* App: LED Sign Webserver
* Project: LAB Jam Session prototype
* Team: Brett Renfer

Description:
* Creates a websocket server (localhost:9094) and connects to PL-M2014R LED Sign.
* People can connect to http://{host-of-where-it's-running}:9094 to change the sign
* NOTE: this is a headless app, so it should be launched from the command line!

************************************************
 SETUP 
************************************************
Hardware Requirements:
  * PL-M2014R LED sign
      * RJ-12 cord
      * Modified RJ-12 to RS-232 adapter (http://wls.wwco.com/ledsigns/prolite/ProliteCable.html)
  * USB to RS-232 adapter
    * Mac drivers: http://sourceforge.net/projects/osx-pl2303/

Local:
  1. Plug in LED sign

************************************************
 RUN 
************************************************

Local:
  1. Run OF app from command line (/directory/to/app/LEDServer.app/Contents/MacOS/LEDServer)

************************************************
 RUN FROM SRC 
************************************************

* Required Libraries
  * openframeworks 0071
  * checkout https://github.com/labatrockwell/ofxLibwebsockets into openframeworks/addons

* Building / Compiling
  * Move the entire folder into openframeworks/examples/LAB
  * open XCode project and compile