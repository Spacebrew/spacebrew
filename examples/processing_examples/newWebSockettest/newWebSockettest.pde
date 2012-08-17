import org.java_websocket.client.WebSocketClient;
import org.java_websocket.drafts.Draft;
import org.java_websocket.handshake.ServerHandshake;

String server="localhost";
String name="processingButton";
String myConfig;

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
  myConfig = "{ "
  + "\"config\": {"
  + "    \"name\": \""+name+"\","
  + "    \"description\": \"This is an example client which has a big red button you can push to send a message. It also listens for color events and will change it's color based on those messages.\","
  + "    \"publish\": {"
  + "      \"messages\": ["
  + "        {"
  + "          \"name\": \"procPress\","
  + "          \"type\": \"boolean\","
  + "          \"default\": \"false\""
  + "        },"
  + "        {"
  + "          \"name\": \"currentColor\","
  + "          \"type\": \"number\","
  + "          \"default\": \"1023\""
  + "        },"
  + "        {"
  + "          \"name\": \"currentMessage\","
  + "          \"type\": \"string\","
  + "          \"default\": \"not-updated\""
  + "        }"
  + "      ]"
  + "    },"
  + "    \"subscribe\": {"
  + "      \"messages\": ["
  + "        {"
  + "          \"name\": \"partyMode\","
  + "          \"type\": \"boolean\""
  + "        },"
  + "        {"
  + "          \"name\": \"color\","
  + "          \"type\": \"number\""
  + "        },"
  + "        {"
  + "          \"name\": \"text\","
  + "          \"type\": \"string\""
  + "        }"
  + "      ]"
  + "    }"
  + "  }"
  + "}";

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
    String testMsg = "{\"name\":[{\"name\":\""+name+"\"}]}";
    println(testMsg);
    c.send(testMsg);
    println(myConfig);
    c.send(myConfig);
    sendingNow =true;
    
  } else {
  
    String testMsg = "{\"message\":{\"clientName\":\""+name+"\",\"name\":\"procPress\",\"type\":\"boolean\",\"value\":\"true\"}}";
    println(testMsg);
    c.send(testMsg);
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
