String server="localhost";
String name="processingButtonJSON";
String description ="This is an example client which has a big red button you can push to send a message. It also listens for color events and will change it's color based on those messages.";

SpacebrewClient c;

// inputs + outputs
boolean toSend = false;
int numClicks = 0;

void setup() {
  size(600, 400);
  
  c = new SpacebrewClient( this );
  
  // add each thing you publish and subscribe to
  c.addPublish( "procPress", toSend );
  
  c.addSubscribe( "partyMode", "boolean" );
  c.addSubscribe( "color", "number" );
  c.addSubscribe( "text", "string" );
  
  // connect!
  c.connect(server, name, description );
}

void draw() {
  background( 255 );
  fill(20);
  textSize(100);
  text(numClicks, 20, 120);
  textSize(30);
  text("Push spacebar to send message", 20, 320);
}

void keyPressed() {   
   c.send( "procPress", toSend);
   toSend = !toSend;
}

void onIntMessage( String name, int value ){
  println("got int message "+name +" : "+ value);
  numClicks++;
}

void onBooleanMessage( String name, boolean value ){
  println("got bool message "+name +" : "+ value);  
  numClicks++;
}

void onStringMessage( String name, String value ){
  println("got string message "+name +" : "+ value);  
  numClicks++;
}
