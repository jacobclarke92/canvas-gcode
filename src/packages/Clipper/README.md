# Clipper TS

A javascript library for polygon clipping (written in TypeScript).  
Rewritten and modernized from an existing JS port of an existing C++ lib.

## Context

Once upon a time there was a humble polygon clipping library written in C++, [released on SourceForge](https://sourceforge.net/projects/polyclipping/) believe it or not. Here's a [fun demo app](https://jsclipper.sourceforge.net/6.4.2.2/main_demo.html) of it in action.

From that [a JS port](https://sourceforge.net/projects/jsclipper/) was born, which also lived on SourceForge.  
A fork is available on npm as `@doodle3d/clipper-lib` and can be found on github [here](https://github.com/junmer/clipper-lib).

Mr or Mrs doodle3d apparently didn't like the port and wrote [their own abstraction layer](https://github.com/Doodle3D/clipper-js) on top of it called `clipper-js`.  
This was my first exposure to clipper so I wanted to credit them for their work.

## Motivation

In a word, type-safety.  
The original js port was [one big unwieldy file](https://github.com/junmer/clipper-lib/blob/master/clipper.js).  
I couldn't find a .d.ts file for it in the wild and I wanted to learn how it worked anyway, so seemed like a good reason to comb through it all and rewrite it.

Secondary motivation is that I was developing my own app for generating GCode based on HTML Canvas commands - a task that called for polygon clipping and path simplification.

## Differences from original JS port

Functionally the same but I added variable names and renamed a lot of things to make it more readable.

I fixed a few bugs I found and made some perf optimizations on the way.
