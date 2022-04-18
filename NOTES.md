# A few notes regarding g-code generation.

Seeing as I'll likely be manually resetting the steppers to zero (at least until I get end-stops, thus auto-homing working), I'll need to run the following command at the start of each draw script to ensure grbl knows that it's 'homed':
`G92 X0 Y0 Z0`

The pen holder servo currently operates between a value of 70 (on paper) and 90 (in air).  
Any retraction larger than that causes the chassis to wobble a bit too much.  
The pen holder servo can be controlled with the following command:  
`M03 Sxxx`  
Where xxx is the desired angle.  
Note `M3 S0` should be prepended to all draw scripts to initialize the stepper.
Similarly running `M5` after completion deactivates the stepper.

I need to update the g-code outputting in this project to inject the above servo controls into the g-code stream instead of using the Z axis.

This is a good reference for commands:  
https://marlinfw.org/meta/gcode/

# Operational issues

The main issue I'm currently experiencing is that the stepper motors are extremely loud and vibrate the whole surface of the chassis - to the point where the line being drawn is quite shaky when viewed up close.  
This could be a lead: https://openbuilds.com/threads/stepper-vibrating-with-grbl-works-well-with-merlin-ramps-1-4.6681/

```
> check step pulse length, and step rate, and micro-stepping setting on the drivers.
> after I enabled micro-stepping and increased feed rate to 1000 it works fine.
> it looks/sounds like full steps.
  could there be a problem with the jumper connections on the drivers?
  maybe they are inverted or just not connected correctly?
  I have Big Easy Drivers that default to 16x microsteps, but the 8825's default to single step unless you fit jumpers on the CNC Shield.
```

So need to check if the shield has jumpers on it.

I also noticed, after first proper test run, the ICs on the cnc shield got pretty hot, so have ordered some mini heat-spreaders.

I found the gcode this app generates is physically too large (might be in inch mode instead of mm?).  
Either way I figured it would safer to start with physically smaller gcode drawings, seeing as getting end-stops working has been a pain in the butt. \
To shrink these drawings down I've been using an app called GCode Ripper (see below).

# Software notes:

I've been using cncjs which despite being 6 years old still manages to get all the required npm packages and run in dev mode just fine.

The arduino is loaded with a modified version of grbl, aptly named grbl-servo: https://github.com/cprezzi/grbl-servo

I've been cropping and resizing the gcode output of this project with an app called GCode Ripper (https://www.scorchworks.com/Gcoderipper/gcoderipper.html), which unfortunately is windows only so I've been using VirtualBox.  
Might be feasible to write my own utility that does the same thing and build it into this project if the currently workflow gets too cumbersome.
