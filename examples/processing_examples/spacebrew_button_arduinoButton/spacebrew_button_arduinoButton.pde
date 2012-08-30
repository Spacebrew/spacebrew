String server="ec2-184-72-140-184.compute-1.amazonaws.com";
String name="processingButtonJSON";
String description ="This is an example client which has a big red button you can push to send a message. It also listens for color events and will change it's color based on those messages.";
import processing.serial.*;

Serial myPort;  // Create object from Serial class
int serialState = 31;

SpacebrewClient c;
int numClicks = 0;
int sec0;

boolean toSend = false;
String stringSend = " Button Time ";

void setup() {
  frameRate(240);
  size(600, 400);
  
  c = new SpacebrewClient( this );
  
  // add each thing you publish and subscribe to
  c.addPublish( "procPress", toSend );
  c.addPublish( "buttonJam", stringSend ); 

    
  c.addSubscribe( "partyMode", "boolean" );
  c.addSubscribe( "color", "number" );
  c.addSubscribe( "text", "string" );
  
  // connect!
  c.connect("ws://"+server+":9000", name, description );
  
  
  // connect to serial
  myPort = new Serial(this, Serial.list()[0], 9600);
   myPort.bufferUntil('\n');
}

void draw() {
  background( 255 );
  fill(20);
  textSize(100);
  text(numClicks, 20, 120);
  textSize(30);
  text("Push spacebar to send message", 20, 320);
  
  if(myPort.available() > 0) {
    serialState = myPort.read();
    if (serialState == 49){
      println("down");
      
      c.send( "buttonJam", stringSend);
    }
  }
  
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
