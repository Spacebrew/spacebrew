String server="ec2-184-72-140-184.compute-1.amazonaws.com"; // spacebrew server
String name="ArduinoRangeOutput"; // name of your app on the server
String description ="This is an example subscriber client for listening to range values";

SpacebrewClient c;

 import processing.serial.*;
 Serial port;
 
 int bright = 0;


void setup() {
  size(600, 400);
  
  c = new SpacebrewClient( this );
  // add each thing you publish and subscribe to
  c.addSubscribe( "brightness", "number" );
  // connect!
  c.connect(server, name, description );
  
  
 println("Available serial ports:");
 println(Serial.list());
 // Uses the first port in this list (number 0).  Change this to
 // select the port corresponding to your Arduino board.  The last
 // parameter (e.g. 9600) is the speed of the communication.  It
 // has to correspond to the value passed to Serial.begin() in your
 // Arduino sketch.
 port = new Serial(this, Serial.list()[0], 9600);  
 // If you know the name of the port used by the Arduino board, you
 // can specify it directly like this.
 //port = new Serial(this, "COM1", 9600);
 
}

void draw() {
  background(bright); //i should be the bringhtness
  
}



void onIntMessage( String name, int value ){
    println("got int message "+name +" : "+ value);
  // map value (0-1023) to bright (0-255);
 // map(value, low1, high1, low2, high2)
 bright = int(map(value, 0, 1023, 0, 255));

  
   port.write(bright); // send the variable bright to the arduino
   // println("sent to Ardunio : "+ brigh);
}



/*
************************************************************************************************
  Dimmer
 
 Demonstrates the sending data from the computer to the Arduino board,
 in this case to control the brightness of an LED.  The data is sent
 in individual bytes, each of which ranges from 0 to 255.  Arduino
 reads these bytes and uses them to set the brightness of the LED.
 
 The circuit:
 LED attached from digital pin 9 to ground.
   
 created 2006  by David A. Mellis  modified 30 Aug 2011 by Tom Igoe and Scott Fitzgerald
 This example code is in the public domain. http://www.arduino.cc/en/Tutorial/Dimmer
 


const int ledPin = 9;      // the pin that the LED is attached to

void setup()
{
  // initialize the serial communication:
  Serial.begin(9600);
  // initialize the ledPin as an output:
  pinMode(ledPin, OUTPUT);
}

void loop() {
  byte brightness;

  // check if data has been sent from the computer:
  if (Serial.available()) {
    // read the most recent byte (which will be from 0 to 255):
    brightness = Serial.read();
    // set the brightness of the LED:
    analogWrite(ledPin, brightness);
  }
}
************************************************************************************************
 */
