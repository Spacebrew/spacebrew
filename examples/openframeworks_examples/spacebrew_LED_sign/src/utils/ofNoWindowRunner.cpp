//
//  ofNoWindowRunner.cpp
//  touchForwarder
//
//  Created by Brett Renfer on 6/7/12.
//  Copyright (c) 2012 Rockwell Group. All rights reserved.
//

#include "ofNoWindowRunner.h"
#include "ofAppRunner.cpp"

void ofSetupNoWindow(ofAppBaseWindow * windowPtr, int w, int h, int screenMode){
	ofSetupNoWindow(ofPtr<ofAppBaseWindow>(windowPtr,std::ptr_fun(noopDeleter)),w,h,screenMode);
}

void ofSetupNoWindow(ofPtr<ofAppBaseWindow> windowPtr, int w, int h, int screenMode){
	window = windowPtr;
	window->setupOpenGL(w, h, screenMode);
}

void ofSetupNoWindow(int w, int h, int screenMode){
#ifdef TARGET_OF_IPHONE
    window = ofPtr<ofAppBaseWindow>(new ofAppiPhoneWindow());
#elif defined TARGET_ANDROID
    window = ofPtr<ofAppBaseWindow>(new ofAppAndroidWindow());
#else
    window = ofPtr<ofAppBaseWindow>(new ofAppGlutWindow());
#endif
    
	ofSetupNoWindow(window,w,h,screenMode);
}