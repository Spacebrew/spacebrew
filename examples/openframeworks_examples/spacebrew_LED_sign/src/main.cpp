#include "ofMain.h"
#include "testApp.h"
#include "ofAppGlutWindow.h"
#include "ofAppNoWindow.h"
#include "ofNoWindowRunner.h"

//========================================================================
int main( ){

	// this kicks off the running of my app
	// can be OF_WINDOW or OF_FULLSCREEN
	// pass in width and height too:
    ofAppNoWindow window;
    ofSetupNoWindow(&window, 10, 10, OF_WINDOW);
	ofRunApp( new testApp());
}
