# nomad-EV-charger-demo
This is a demo to envision how nomad could provide coordination and meaning to EV charger management.

We see that people will often park at an ev charger spots and then don't leave.  

This demo will be using 3 different particles that each have triggers. There is are nomad atomic nodes for each of the devices. There is a composite node that subscribes to these three and then notifies a relevant party using twilio's sms. 
