//
//  SpaceBrew.h
//  LEDServer
//
//  Created by rockwell on 8/17/12.
//
//

#pragma once

namespace SpaceBrew {
    
    class Message {
    public:
        
        Message(){
            _name = "";
            _type = "";
            _default = "";
        }
        
        string _name, _type, _default;
    };
    
    class Config {
    public:
        
        void addSubscribe( string name, string type, string def){
            subscribe.push_back( Message() );
            subscribe.back()._name = name;
            subscribe.back()._type = type;
            subscribe.back()._default = def;
        }
        
        void addPublish( string name, string type, string def){
            publish.push_back( Message() );
            publish.back()._name = name;
            publish.back()._type = type;
            publish.back()._default = def;            
        }
        
        string getNameMessage(){
            return "{\"name\": [{\"name\":\"" + name + "\"}]}";
        }
        
        string getConfig(){
            string message = "{\"config\": {\"name\": \"" + name +"\",\"description\":\"" + description +"\",\"publish\": {\"messages\": [";
            
            for (int i=0, len=publish.size(); i<len; i++){
                message += "{\"name\":\"" + publish[i]._name + "\",";
                message += "\"type\":\"" + publish[i]._type + "\",";
                message += "\"default\":\"" + publish[i]._default + "\"";
                message += "}";
                if ( i+1 < len ){
                    message += ",";
                }
            }
            
            message += "]},\"subscribe\": {\"messages\": [";
            
            for (int i=0, len=subscribe.size(); i<len; i++){
                message += "{\"name\":\"" + subscribe[i]._name + "\",";
                message += "\"type\":\"" + subscribe[i]._type + "\",";
                message += "\"default\":\"" + subscribe[i]._default + "\"";
                message += "}";
                if ( i+1 < len ){
                    message += ",";
                }                
            }
            
            message += "]}}}";
            
            return message;
        }
        
        string name, description;
        
    private:
        
        vector<Message> publish;
        vector<Message> subscribe;
        
    };
}