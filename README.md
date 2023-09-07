# Canvas GCode

Based on the great work done by Emery Denuccio on their [`gcanvas` project](https://github.com/em/gcanvas)

## [View demo here](https://jacobclarke92.github.io/canvas-gcode/dist/)

I've written this with the intention of generating GCode for use with a Pen Plotter (instead of a CNC machine), but could also be easily adapted for laser cutting.

The main difference is that the pen plotter has a servo motor to raise and lower the pen, whereas a CNC machine would use the Z axis stepper motor to do the same thing.

This project also includes various sketches I made in an attempt to couple generative art creation with a useful tool.

```
yarn
yarn start
# open http://localhost:9000
```
