String server="lab-server.local";
String name="processingButtonJSON";
String description ="This is an example client which has a big red button you can push to send a message. It also listens for color events and will change it's color based on those messages.";

SpacebrewClient c;
int numClicks = 0;
int sec0;

boolean toSend = false;

void setup() {
  frameRate(240);
  size(600, 400);
  
  c = new SpacebrewClient( this );
  
  // add each thing you publish and subscribe to
  c.addPublish( "procPress", toSend );
  
  c.addSubscribe( "partyMode", "boolean" );
  c.addSubscribe( "color", "number" );
  c.addSubscribe( "text", "string" );
  
  // connect!
  c.connect("ws://"+server+":9000", name, description );
}

void draw() {
  background( inputColor );
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
}

void onBooleanMessage( String name, boolean value ){
  println("got bool message "+name +" : "+ value);  
}

void onStringMessage( String name, String value ){
  println("got string message "+name +" : "+ value);  
}
