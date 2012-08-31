// Sweep
// by BARRAGAN <http://barraganstudio.com> 
// This example code is in the public domain.


#include <Servo.h> 
 
Servo myservo;  // create servo object to control a servo 
                // a maximum of eight servo objects can be created 
 
int pos                 = 0;    // variable to store the servo position 
String inputString      = "";
boolean bStringComplete = false;
float mult = (180.0/1024.0);
 
void setup() 
{ 
  Serial.begin(9600);
  myservo.attach(10);  // attaches the servo on pin 9 to the servo object 
  myservo.write(180);
} 
 
 
void loop() 
{
  
  while (Serial.available()) {
    // get the new byte:
    char inChar = (char)Serial.read(); 
    // add it to the inputString:
    inputString += inChar;
    // if the incoming character is a newline, set a flag
    // so the main loop can do something about it:
    if (inChar == '\n') {
      bStringComplete = true;
    } 
  }
  
  if (bStringComplete) {
      bStringComplete = false;
    
    char this_char[inputString.length() + 1];
    inputString.toCharArray(this_char, sizeof(this_char));
    pos = atoi(this_char);
    myservo.write( int(min(180,pos * mult)) );
  Serial.println( int(min(180,pos * mult)) );
    inputString = "";
    
    // clear the string:
    inputString = "";
  }
} 
