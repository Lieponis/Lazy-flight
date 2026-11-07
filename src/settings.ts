// ONE EASY PLACE TO CHANGE THE LOOK.
//
// The game is drawn on a tiny hidden canvas of RENDER_WIDTH x RENDER_HEIGHT
// pixels, then stretched to fill the window without smoothing. That stretch is
// what makes the chunky pixel look.
//
//   Smaller numbers = chunkier pixels (and faster on phones).
//   Larger numbers  = sharper picture.
//
// Keep the shape 16:9 (width divided by height should be about 1.78),
// for example 320x180 or 400x225 or 480x270.

export const RENDER_WIDTH = 320;
export const RENDER_HEIGHT = 180;

// Near-black space blue.
export const BACKGROUND_COLOR = 0x05060d;
