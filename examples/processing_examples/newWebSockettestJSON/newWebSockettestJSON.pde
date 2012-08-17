import org.java_websocket.client.WebSocketClient;
import org.java_websocket.drafts.Draft;
import org.java_websocket.handshake.ServerHandshake;
import org.json.*; //https://github.com/agoransson/JSON-processing

String server="localhost";
String name="processingButtonJSON";
JSONObject tConfig = new JSONObject();
 
ExampleClient c;
int numClicks = 0;
boolean sendingNow = false;
int sec0;

void setup() {
  frameRate(240);
  size(600,400);
  try {
    openSocket();
  } catch (Exception e) {
    println(e.getMessage());
  }
  JSONArray publishers = new JSONArray();
  
  // LOAD IN PUBLISH INFO
  JSONObject procPress = new JSONObject();
  procPress.put("name","procPress");
  procPress.put("type","boolean");
  procPress.put("default","false");
  
  JSONObject currentColor = new JSONObject();
  currentColor.put("name","currentColor");
  currentColor.put("type","number");
  currentColor.put("default","1023");
  
  JSONObject currentMessage = new JSONObject();
  currentMessage.put("name","currentMessage");
  currentMessage.put("type","string");
  currentMessage.put("default","not-updated");
  
  publishers.put(procPress);
  publishers.put(currentColor);
  publishers.put(currentMessage);
    
  
  // LOAD IN SUBSCRIBE INFO
  JSONArray subscribers = new JSONArray();
    
  JSONObject partyMode = new JSONObject();
  partyMode.put("name","partyMode");
  partyMode.put("type","boolean");
  
  JSONObject jcolor = new JSONObject();
  jcolor.put("name","color");
  jcolor.put("type","number");
  
  JSONObject jtext = new JSONObject();
  jtext.put("name","text");
  jtext.put("type","string");
  
  subscribers.put(procPress);
  subscribers.put(currentColor);
  subscribers.put(currentMessage);
    
  JSONObject mObj = new JSONObject();
  JSONObject tMs1 = new JSONObject();
  JSONObject tMs2 = new JSONObject();
  tMs1.put("messages",subscribers);
  tMs2.put("messages",publishers);
  mObj.put("name", name);
  mObj.put("description", "This is an example client which has a big red button you can push to send a message. It also listens for color events and will change it's color based on those messages.");
  mObj.put("publish", tMs1);
  mObj.put("subscribe", tMs2);
  
  tConfig.put("config", mObj);
  println(tConfig);
  
}

void draw() {
  background(255);
  fill(20);
  textSize(100);
  text(numClicks,20,120);
  textSize(30);
  text("Push c to connect",20,220);
  text("Push spacebar to send message",20,320);
  
//  if (sendingNow == true) {
//      String testMsg = "{\"message\":{\"name\":\"buttonPress\",\"type\":\"boolean\",\"value\":\"false\"}}";
//      c.send(testMsg);
//  }
  
//  int sec = second();
//  if (sec != sec0){println("FPS: "+frameRate);}
//  sec0 = sec;
}

void keyPressed() {
  if(key == 'c') {
    JSONArray tA = new JSONArray();
    JSONObject tName = new JSONObject();
    tName.put("name", name);
    tA.put(tName);
    
    JSONObject nMsg = new JSONObject();
    nMsg.put("name", tA);
    c.send(nMsg.toString());
    println(nMsg.toString());
    
    c.send(tConfig.toString());
    sendingNow =true;
  } else {
    
    String testMsg = "{\"message\":{\"clientName\":\""+name+"\",\"name\":\"procPress\",\"type\":\"boolean\",\"value\":\"true\"}}";
    JSONObject tM = new JSONObject();
    tM.put("clientName", name);
    tM.put("name", "procPress");
    tM.put("type", "boolean");
    tM.put("value", "true");
    JSONObject fM = new JSONObject();
    fM.put("message", tM);
    c.send(fM.toString());
  }
}

void openSocket() throws URISyntaxException {
  println("opening socket");
    c = new ExampleClient( new URI( "ws://"+server+":9000" ) );
    c.connect();
    //println(c);
    
}


public class ExampleClient extends WebSocketClient {

	public ExampleClient( URI serverUri , Draft draft ) {
		super( serverUri, draft );
	}

	public ExampleClient( URI serverURI ) {
		super( serverURI );
	}

	@Override
	public void onOpen( ServerHandshake handshakedata ) {
            println("Connected to socket");
	}

	@Override
	public void onMessage( String message ) {
          //println(message);
          numClicks++;
	}

	@Override
	public void onClose( int code, String reason, boolean remote ) {
            println("closed connection");
	}

	@Override
	public void onError( Exception ex ) {
	}

//	public static void main( String[] args ) throws URISyntaxException {
//		ExampleClient c = new ExampleClient( new URI( "ws://localhost:8887" ), new Draft_10() );
//		c.connect();
//	}

}
