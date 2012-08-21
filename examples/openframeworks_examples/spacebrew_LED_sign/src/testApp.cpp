#include "testApp.h"

// change this to connect to remote or local host
// TO-DO: Should be command line arg
string server = "localhost";

string config = "";
bool    bConnected = false;

int     lastSent    = 0;

//--------------------------------------------------------------
void testApp::setup(){
    port.listDevices();
    
    int index = 0;
    for (int i=0; i<port.getDeviceList().size(); i++){
        if ( port.getDeviceList()[i].getDeviceName().find("Blue") == string::npos){
            index = i;
            break;
        }
    }
    
    port.setup(index,9600);
    
    ofxLibwebsockets::ClientOptions options = ofxLibwebsockets::defaultClientOptions();
    options.host = server;
    options.port = 9000;
    
    bConnected = client.connect(options);
    
    config.name = "lab-LED-sign";
    config.description = "LED sign in the LAB back bay";
    config.addSubscribe( "text", "string", "");
    config.addSubscribe( "party mode", "boolean", "false");
    config.addSubscribe( "color", "number", "1023");
    config.addPublish( "text", "string", "");
    
    stringValue = "";
    // this adds your app as a listener for the server
    client.addListener(this);
    
    ofSetFrameRate(60);
    
    colors[0] = "<CA>";
    colors[1] = "<CB>";
    colors[2] = "<CC>";
    colors[3] = "<CD>";
    colors[4] = "<CE>";
    colors[5] = "<CF>";
    colors[6] = "<CG>";
    colors[7] = "<CH>";
    colors[8] = "<CI>";
    colors[9] = "<CJ>";
    colors[10] = "<CK>";
    colors[11] = "<CL>";
    colors[12] = "<CM>";
    colors[13] = "<CN>";
    colors[14] = "<CO>";
    colors[15] = "<CP>";

    string msg = "<ID01><PA><FB>start\r\n";
    port.writeBytes((unsigned char *)msg.c_str(), msg.length());  
}

//--------------------------------------------------------------
void testApp::update(){
    // avoid timeout
    if ( ofGetElapsedTimef() - lastSent > 5 ){
        lastSent = ofGetElapsedTimef();
        client.send("0");
    }
}

//--------------------------------------------------------------
void testApp::draw(){
}

//--------------------------------------------------------------
void testApp::onConnect( ofxLibwebsockets::Event& args ){
    cout<<"on connected"<<endl;
    //args.conn.send("{\"string\":\"" + stringValue + "\",\"bool\":\"" + ofToString(boolValue) + "\",\"int\":\"" + ofToString(intValue) + "\"}");
}

//--------------------------------------------------------------
void testApp::onOpen( ofxLibwebsockets::Event& args ){
    cout<<"new connection open"<<endl;
    //messages.push_back("New connection from " + args.conn.getClientIP() + ", " + args.conn.getClientName() );
    client.send(config.getNameMessage());   
    client.send(config.getConfig());
    cout << "send " << config.getNameMessage() << endl;
    cout << "send " << config.getConfig() << endl;
}

//--------------------------------------------------------------
void testApp::onClose( ofxLibwebsockets::Event& args ){
    cout<<"on close"<<endl;
    messages.push_back("Connection closed");
}

//--------------------------------------------------------------
void testApp::onIdle( ofxLibwebsockets::Event& args ){
    cout<<"on idle"<<endl;
}

//--------------------------------------------------------------
void testApp::onMessage( ofxLibwebsockets::Event& args ){
    cout<<"got message "<<args.message<<endl;
    
    // trace out string messages or JSON messages!
    if ( args.json != NULL){
        string type = args.json["message"]["type"].asString();
        if ( type == "string" && args.json["message"]["value"].isString()){
            stringValue = args.json["message"]["value"].asString();
        } else if ( type == "boolean" ){
            if ( args.json["message"]["value"].isInt() ){
                boolValue = args.json["message"]["value"].asInt();
            } else if ( args.json["message"]["value"].isString() ){
                string val = args.json["message"]["value"].asString();
                boolValue = ofToBool(val);                
            }
        } else if ( type == "number" ){
            if ( args.json["message"]["value"].isInt() ){
                intValue = args.json["message"]["value"].asInt();
            } else if ( args.json["message"]["value"].isString() ){
                string val = args.json["message"]["value"].asString();
                intValue = ofToInt(val);                
            }
        }
        
        // construct message
        int where = floor(intValue / 64);
        
        string msg;
        if (boolValue){
            msg = "<ID01><PA><FN>" + colors[where] + stringValue+"\r\n";
        } else {
            msg = "<ID01><PA>" + colors[where] + stringValue+"\r\n";            
        }
        port.writeBytes((unsigned char *)msg.c_str(), msg.length());
        cout<<"sending "<<"{\"message\":{\"clientname\":\"" + config.name +"\",\"name\":\"text\",\"type\":\"string\",\"value\":\"" + stringValue +"\"}}"<<endl;
        //client.send("{\"message\":{\"clientname\":\"" + config.name +"\",\"name\":\"text\",\"type\":\"string\",\"value\":\"" + stringValue +"\"}}");
    } else {
        //args.message
        string msg = "<ID01><PA>"+args.message+"\r\n";
        port.writeBytes((unsigned char *)msg.c_str(), msg.length());      
    }
}

//--------------------------------------------------------------
void testApp::onBroadcast( ofxLibwebsockets::Event& args ){
    cout<<"got broadcast "<<args.message<<endl;    
}

//--------------------------------------------------------------
void testApp::keyPressed(int key){
    // do some typing!
    if ( key != OF_KEY_RETURN ){
        if ( key == OF_KEY_BACKSPACE ){
            if ( toSend.length() > 0 ){
                toSend.erase(toSend.end()-1);
            }
        } else {
            toSend += key;
        }
    } else {
        // send to all clients
        //server.send( toSend );
        /*messages.push_back("Sent: '" + toSend + "' to "+ ofToString(server.getConnections().size())+" websockets" );
        toSend = "";*/
    }
}

//--------------------------------------------------------------
void testApp::keyReleased(int key){

}

//--------------------------------------------------------------
void testApp::mouseMoved(int x, int y ){

}

//--------------------------------------------------------------
void testApp::mouseDragged(int x, int y, int button){

}

//--------------------------------------------------------------
void testApp::mousePressed(int x, int y, int button){
}

//--------------------------------------------------------------
void testApp::mouseReleased(int x, int y, int button){

}

//--------------------------------------------------------------
void testApp::windowResized(int w, int h){

}

//--------------------------------------------------------------
void testApp::gotMessage(ofMessage msg){

}

//--------------------------------------------------------------
void testApp::dragEvent(ofDragInfo dragInfo){ 

}