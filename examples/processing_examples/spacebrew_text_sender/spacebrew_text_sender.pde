/*****************************************************************
  SPACEBREW - Processing text sender
*****************************************************************/
String server="localhost";  // change to the url of your host if not local!

SpacebrewClient sb;
String name="processingText";
String description ="This app lets you send some text to Sb via Processing. It can also receive text!";

// inputs + outputs
String sendText = "";
String inText = "";

void setup() {
  size(600, 400);
  
  sb = new SpacebrewClient( this );
  
  // add each thing you publish and subscribe to
  sb.addPublish( "p5OutText", sendText );
  sb.addSubscribe( "p5InText", "string" );
    
  // connect!
  sb.connect(server, name, description );
}

void draw() {
  background( 255 );
  fill(20);
  textSize(30);
  text("Out: "+sendText, 20, 60);
  text("In: "+inText, 20, 190);
  text("Type some text!\nPush Enter to send.", 20, 320);
}

void keyPressed() {
  if ( key == BACKSPACE ){
    if ( sendText.length() > 0 ){
      sendText = sendText.substring(0,sendText.length()-1);
    }
  } else if ( key != ENTER && key != CODED){
    sendText += key;
  } else if ( key == ENTER){
    
    // send message named "p5OutText"
    // - this is the same as sb.send( "p5OutText", "string", sendText );
     sb.send( "p5OutText", sendText);
  }
}

void onStringMessage( String name, String value ){
  // add to our input text
  inText = value;
}
