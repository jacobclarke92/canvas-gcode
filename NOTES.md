# A few notes regarding g-code generation.

This is a good reference for commands:  
https://marlinfw.org/meta/gcode/

## Workspace size

At present, without a larger bit of wood to allow the Y axis to cover its full range of motion the canvas is limited to:
X180 x Y110

A4 equates to about  
X140 x Y100

Full range is actually 180 x 180

## Zeroing out the XY axis

Seeing as I'll likely be manually resetting the steppers to zero (at least until I get end-stops, thus auto-homing working), I'll need to run the following command at the start of each draw script to ensure grbl knows that it's 'homed':
`G92 X0 Y0 Z0`  
CORRECTION: The above is for setting the TEMPORARY offset, the below will give a persistent offset which are stored to memory:
`G10 L20 P1 X0 Y0`

## Pen holder

The pen holder servo currently operates between a value of 70 (on paper) and 90 (in air).  
Any retraction larger than that causes the chassis to wobble a bit too much.  
The pen holder servo can be controlled with the following command:  
`M03 Sxxx`  
Where xxx is the desired angle.

Note: `M3 S0` should be prepended to all draw scripts to initialize the stepper.
Similarly running `M5` after completion deactivates the stepper.

I need to update the g-code outputting in this project to inject the above servo controls into the g-code stream instead of using the Z axis.

# Software notes:

I've been using cncjs which despite being 6 years old still manages to get all the required npm packages and run in dev mode just fine.

The arduino is loaded with a modified version of grbl, aptly named grbl-servo: https://github.com/cprezzi/grbl-servo

I've been cropping and resizing the gcode output of this project with an app called GCode Ripper (https://www.scorchworks.com/Gcoderipper/gcoderipper.html), which unfortunately is windows only so I've been using VirtualBox.  
Might be feasible to write my own utility that does the same thing and build it into this project if the currently workflow gets too cumbersome.

# 2022-04-18 Operational issues

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
_NOTE:_ I later resolved this! It had jumpers under the mini stepper driver boards, I needed 3 on each to reduce it to 1/16th steps

I also noticed, after first proper test run, the ICs on the cnc shield got pretty hot, so have ordered some mini heat-spreaders.

I found the gcode this app generates is physically too large (might be in inch mode instead of mm?).  
Either way I figured it would safer to start with physically smaller gcode drawings, seeing as getting end-stops working has been a pain in the butt. \
To shrink these drawings down I've been using an app called GCode Ripper (see below).

# 2024-07-06 Fresh start

Got a new pen plotter - cheap-ish one found on ebay:  
Vigotec VG-X4  
http://www.vigotec.cn/X4/  
http://vigotec.cn/software/VigoWriter_v2.1_for_writer_control.zip

Notes from another tinkerer:  
https://www.extremeelectronics.co.uk/vigo-tec-vg-a4-writer-engraver/

```
So after a lot of trying things I found the PenUP/Pen Down commands which are M03 and M05 respectively. You will need a delay for the pen server to do its thing, Im currently using G4 P1000 to give a 1 second delay.

Be careful using G0 the plotter appears to lose position even with the lightest of pens. To cure this and especially if you are using anything heavier, use a G1 X Y Z FXXXX to set the feed rate. ( When using G-Code the speed slider is ignored)
```

Consistent usage of software:

- disconnect device
- connect device
- ensure pen up is 60% and pen down is 17%
- trigger pen down
- trigger up
- open gcode
