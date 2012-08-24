import org.json.*; //https://github.com/agoransson/JSON-processing
import java.lang.reflect.Method;

public class SpacebrewClient {

  PApplet parent;
  Method  onIntMessageMethod, onStringMessageMethod, onBooleanMessageMethod;
  SimpleWSClient wsClient;
  JSONObject tConfig = new JSONObject();
  JSONObject nameConfig = new JSONObject();
  
  //------------------------------------------------
  SpacebrewClient( PApplet _parent ){
    publishes = new ArrayList();
    subscribes = new ArrayList();
    parent = _parent; 
    setupMethods();   
  }
  
  //------------------------------------------------
  private void setupMethods(){
    try {
      onIntMessageMethod = parent.getClass().getMethod("onIntMessage", new Class[]{String.class, int.class});
    } catch (Exception e){
      println("no onIntMessage method implemented");
    }

    try {
      onStringMessageMethod = parent.getClass().getMethod("onStringMessage", new Class[]{String.class, String.class});
    } catch (Exception e){
      println("no onStringMessage method implemented");
    }

    try {
      onBooleanMessageMethod = parent.getClass().getMethod("onBooleanMessage", new Class[]{String.class, boolean.class});
    } catch (Exception e){
      println("no onBooleanMessage method implemented");
    }    
  }
  
  //------------------------------------------------
  public void addPublish( String name, boolean _default ){
    SpacebrewMessage m = new SpacebrewMessage();
    m.name = name; 
    m.type = "boolean"; 
    if ( _default){
      m._default = "true";
    } else {
      m._default = "false";
    }
    publishes.add(m);
  }
  
  //------------------------------------------------
  public void addPublish( String name, int _default ){
    SpacebrewMessage m = new SpacebrewMessage();
    m.name = name; 
    m.type = "number"; 
    m._default = str(_default);
    publishes.add(m);
  }
  
  //------------------------------------------------
  public void addPublish( String name, String _default ){
    SpacebrewMessage m = new SpacebrewMessage();
    m.name = name; 
    m.type = "string"; 
    m._default = _default;
    publishes.add(m);
  }
  
  //------------------------------------------------
  public void addPublish( String name, String type, String _default ){
    SpacebrewMessage m = new SpacebrewMessage();
    m.name = name; 
    m.type = type; 
    m._default = _default;
    publishes.add(m);
  }
  
  //------------------------------------------------
  // RIGHT NOW THIS JUST ADDS TO THE MESSAGE SENT ONOPEN
  // in the future, could be something like name, type, default, CALLBACK
  public void addSubscribe( String name, String type ){
    SpacebrewMessage m = new SpacebrewMessage();
    m.name = name;
    m.type = type;
    subscribes.add(m);
  }
  
  //------------------------------------------------
  // ASSUMES YOU'VE SET UP YOUR PUBLISHES + SUBSCRIBES
  public void connect( String url, String _name, String _description ){
    name = _name;
    description = _description;
    try {
      println("connecting "+url);
      wsClient = new SimpleWSClient( this, url );    
      wsClient.connect();
    }
    catch (Exception e){
      println("ERROR!");
      println(e.getMessage());
    }  
    JSONArray publishers = new JSONArray();
  
    // LOAD IN PUBLISH INFO
    for (int i=0, len=publishes.size(); i<len; i++){
        SpacebrewMessage m = (SpacebrewMessage) publishes.get(i);
        JSONObject pub = new JSONObject();
        pub.put("name",m.name);
        pub.put("type",m.type);
        pub.put("default",m._default);
        
        publishers.put(pub);      
    }
      
    // LOAD IN SUBSCRIBE INFO
    JSONArray subscribers = new JSONArray();
      
   for (int i=0; i<subscribes.size(); i++){
        SpacebrewMessage m = (SpacebrewMessage) subscribes.get(i);
        JSONObject subs = new JSONObject();
        subs.put("name",m.name);
        subs.put("type",m.type);
        
        subscribers.put(subs);      
    }
      
    JSONObject mObj = new JSONObject();
    JSONObject tMs1 = new JSONObject();
    JSONObject tMs2 = new JSONObject();
    tMs1.put("messages",subscribers);
    tMs2.put("messages",publishers);
    mObj.put("name", name);
    mObj.put("description", description);
    mObj.put("subscribe", tMs1);
    mObj.put("publish", tMs2);    
    tConfig.put("config", mObj);    
    
    // SETUP NAME MESSAGE
    JSONObject nm = new JSONObject();
    nm.put("name", name);
    JSONArray arr = new JSONArray();
    arr.put(nm);
    nameConfig.put("name", arr);
  }
  
  //------------------------------------------------
  public void send( String messageName, String type, String value ){
    
    JSONObject m = new JSONObject();
    m.put("clientName", name);
    m.put("name", messageName);
    m.put("type", type);
    m.put("value", value);
    
    JSONObject sM = new JSONObject();
    sM.put("message", m);
    
    wsClient.send( sM.toString() );
  }
  
  //------------------------------------------------
  public void send( String messageName, int value ){
    
    JSONObject m = new JSONObject();
    m.put("clientName", name);
    m.put("name", messageName);
    m.put("type", "number");
    m.put("value", str(value));
    
    JSONObject sM = new JSONObject();
    sM.put("message", m);
    
    wsClient.send( sM.toString() );
  }
  
  //------------------------------------------------
  public void send( String messageName, boolean value ){
    
    println(name);
    
    JSONObject m = new JSONObject();
    m.put("clientName", name);
    m.put("name", messageName);
    m.put("type", "boolean");
    m.put("value", str(value));
    
    JSONObject sM = new JSONObject();
    sM.put("message", m);
    
    wsClient.send( sM.toString() );
    println(sM.toString());
  }
  
  //------------------------------------------------
  public void send( String messageName, String value ){
    
    JSONObject m = new JSONObject();
    m.put("clientName", name);
    m.put("name", messageName);
    m.put("type", "string");
    m.put("value", value);
    
    JSONObject sM = new JSONObject();
    sM.put("message", m);
    
    wsClient.send( sM.toString() );
  }
  
  //------------------------------------------------
  public void onOpen(){
    println("connection open!");
    // send config
    wsClient.send(nameConfig.toString());
    wsClient.send(tConfig.toString());
  }
  
  //------------------------------------------------
  public void onClose(){
    println("connection closed!");
  }
  
  //------------------------------------------------
  public void onMessage( String message ){
    JSONObject m = new JSONObject( message ).getJSONObject("message");
    
    String name = m.getString("name");
    String type = m.getString("type");
    
    if ( type.equals("string") ){
      if ( onStringMessageMethod != null ){
        try {
          onStringMessageMethod.invoke( parent, name, m.getString("value"));
        } catch( Exception e ){
          println("onStringMessageMethod invoke failed, disabling :(");
          onStringMessageMethod = null;
        }
      }
    } else if ( type.equals("boolean")){
      if ( onBooleanMessageMethod != null ){
        try {
          onBooleanMessageMethod.invoke( parent, name, m.getBoolean("value"));
        } catch( Exception e ){
          println("onBooleanMessageMethod invoke failed, disabling :(");
          onBooleanMessageMethod = null;
        }
      }
    } else if ( type.equals("number")){
      if ( onIntMessageMethod != null ){
        try {
          onIntMessageMethod.invoke( parent, name, m.getInt("value"));
        } catch( Exception e ){
          println("onIntMessageMethod invoke failed, disabling :(");
          onIntMessageMethod = null;
        }
      }
    } else {
      println("Received message of unknown type "+type);
    }
  }
  
  ArrayList   publishes, subscribes;
  String      name, description;
};

class SpacebrewMessage {
  // to-do: this is weird!
  String name, type, _default;
  int       intValue;
  String    stringValue;
  boolean   boolValue;
}
