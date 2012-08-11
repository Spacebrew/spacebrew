import org.java_websocket.client.WebSocketClient;
import org.java_websocket.drafts.Draft;
import org.java_websocket.handshake.ServerHandshake;

ExampleClient c;
int numClicks = 0;
boolean sendingNow = false;

void setup() {
  size(600,400);
  try {
    openSocket();
  } catch (Exception e) {
    println(e.getMessage());
  }
}

void draw() {
  background(255);
  fill(20);
  textSize(100);
  text(numClicks,20,120);
  textSize(30);
  text("Push c to connect",20,220);
  text("Push spacebar to send message",20,320);
  
  if (sendingNow == true) {
      String testMsg = "{\"message\":[{\"name\":\"buttonPress\",\"type\":\"boolean\",\"value\":\"false\"}]}";
      c.send(testMsg);
  }
}

void keyPressed() {
  if(key == 'c') {
    String testMsg = "{\"name\":[{\"name\":\"hellojava\"}]}";
    c.send(testMsg);
    sendingNow =true;
  }
  
 // String testMsg = "{\"message\":[{\"name\":\"buttonPress\",\"type\":\"boolean\",\"value\":\"false\"}]}";
 // c.send(testMsg);
}

void openSocket() throws URISyntaxException {
  println("opening socket");
    c = new ExampleClient( new URI( "ws://localhost:9000" ) );
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
          println(message);
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
