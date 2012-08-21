//
//  ofNoWindowRunner.h
//  touchForwarder
//
//  Created by Brett Renfer on 6/7/12.
//  Copyright (c) 2012 Rockwell Group. All rights reserved.
//

#pragma once

#include "ofMain.h"

void ofSetupNoWindow(ofAppBaseWindow * windowPtr, int w, int h, int screenMode);
void ofSetupNoWindow(ofPtr<ofAppBaseWindow> windowPtr, int w, int h, int screenMode);
void ofSetupNoWindow(int w, int h, int screenMode);