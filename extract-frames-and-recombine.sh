# split distinct frames from video
ffmpeg -i input.mov -vf "select='gt(scene,0.1)'" -vsync vfr -frame_pts 1 frame_%06d.png

# merge frames to video
ffmpeg -framerate 30 -pattern_type glob -i 'frame_*.png' -c:v libx264 -pix_fmt yuv420p output.mp4

# rotate video left
ffmpeg -i output.mp4 -vf "transpose=2" output2.mp4