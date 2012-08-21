#pragma once

#include "ofMain.h"

#include "SpaceBrew.h"
#include "ofxLibwebsockets.h"

#define NUM_MESSAGES 30 // how many past messages we want to keep

class testApp : public ofBaseApp{

	public:
		void setup();
		void update();
		void draw();

		void keyPressed  (int key);
		void keyReleased(int key);
		void mouseMoved(int x, int y );
		void mouseDragged(int x, int y, int button);
		void mousePressed(int x, int y, int button);
		void mouseReleased(int x, int y, int button);
		void windowResized(int w, int h);
		void dragEvent(ofDragInfo dragInfo);
		void gotMessage(ofMessage msg);
		
        ofxLibwebsockets::Client    client;
        SpaceBrew::Config           config;
    
    
        bool bConnected;
    
        //queue of rec'd messages
        vector<string> messages;
    
        //string to send to clients
        string  toSend;
        string  stringValue;
        int     intValue;
        bool    boolValue;
        
        // colors
        string  colors[16];
    
        // websocket methods
        void onConnect( ofxLibwebsockets::Event& args );
        void onOpen( ofxLibwebsockets::Event& args );
        void onClose( ofxLibwebsockets::Event& args );
        void onIdle( ofxLibwebsockets::Event& args );
        void onMessage( ofxLibwebsockets::Event& args );
        void onBroadcast( ofxLibwebsockets::Event& args );
    
        ofSerial port;
};