/************************
 * Company | IDEO
 * Department | CoLab
 * Project | NomadExedition-Energy-EVChargerDemo
 * Who | Eric Chan
 * Build | Version 0
 * *********************/
// LIBRARIES //

// Variables //
#define BoardLED D7

const int buttonPin = A0;

// bool occupancyStatus = false;
int buttonState = 0;
int DELAY = 1000;

void setup() {
  Serial.begin(115200);
  pinMode(BoardLED, OUTPUT);
  pinMode(buttonPin, INPUT);
}

void loop() {
  
  checkSensors();
  delay(DELAY);
}

void checkSensors() { 
  buttonState = digitalRead(buttonPin);
  if (buttonState == HIGH) {
    digitalWrite(BoardLED, HIGH);
    Particle.publish("Charging_Station :", "occupied", 60, PUBLIC);
    Serial.println("Charging_Station : occupied");
  } else {
    digitalWrite(BoardLED, LOW);
    Particle.publish("Charging_Station :", "unoccupied", 60, PUBLIC);
    Serial.println("Charging_Station : unoccupied");
  }
}

