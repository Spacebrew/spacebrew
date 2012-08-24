// import general java stuff for server

// import java-websocket stuff
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.drafts.Draft;
import org.java_websocket.handshake.ServerHandshake;
import java.lang.reflect.Method;

public class SimpleWSClient extends WebSocketClient {

  Object parent;
  Method onOpenMethod, onCloseMethod, onMessageMethod;

  public SimpleWSClient( Object app, URI serverUri, Draft draft ) {
    super( serverUri, draft );
    parent = app;
    setupMethods();
  }

  public SimpleWSClient( Object app, URI serverURI ) {
    super( serverURI );
    parent = app;
    setupMethods();
  }

  public SimpleWSClient( Object app, String url ) throws URISyntaxException {
    super( new URI( url ));
    parent = app;
    setupMethods();
  }

  public SimpleWSClient( Object app, String server, int port ) throws URISyntaxException {
    super( new URI( server +":"+str(port ) ));
    parent = app;
    setupMethods();
  }

  private void setupMethods() {
    try {
      onOpenMethod = parent.getClass().getMethod("onOpen", new Class[] {
      }
      );
    } 
    catch (Exception e) {
      println("beef");
    }

    try {
      onCloseMethod = parent.getClass().getMethod("onClose", new Class[] {
      }
      );
    } 
    catch (Exception e) {
      println("beef");
    }

    try {
      onMessageMethod = parent.getClass().getMethod("onMessage", new Class[] {
        String.class
      }
      );
    } 
    catch (Exception e) {
      println("beef");
    }
  }

  @Override
    public void onOpen( ServerHandshake handshakedata ) {
      println("on open");
    if ( onOpenMethod != null ) {
      try {
        onOpenMethod.invoke( parent );
      } 
      catch( Exception e ) {
        println("onMessage invoke failed, disabling :(");
        onOpenMethod = null;
      }
    }
  }

  @Override
    public void onMessage( String message ) {
    if ( onMessageMethod != null ) {
      try {
        onMessageMethod.invoke( parent, message);
      } 
      catch( Exception e ) {
        println("onMessage invoke failed, disabling :(");
        onMessageMethod = null;
      }
    }
  }

  @Override
    public void onClose( int code, String reason, boolean remote ) {
      println("on close");
    if ( onCloseMethod != null ) {
      try {
        onCloseMethod.invoke( parent );
      } 
      catch( Exception e ) {
        println("onMessage invoke failed, disabling :(");
        onCloseMethod = null;
      }
    }
  }

  @Override
    public void onError( Exception ex ) {
      println("on error :(");
    }
}

