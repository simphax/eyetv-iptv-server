# eyetv-iptv-server
EyeTV->IPTV server

Provides an interface for an IPTV frontend to stream EyeTV channels, for example Kodi's IPTV Simple PVR Client. It provides a m3u8 playlist with url's to stream uncompressed EyeTV live channels.

The service needs to be run on the same machine as the EyeTV application, and EyeTV have to be activated for iPhone access.

## Setup
Run the service and set up the IPTV client to use **http://localhost:9898/playlist.m3u8** as the M3U playlist.

## Command-line arguments
```
--port=PORT
  Server port.
  Default: 9898
  
--vlc-port=PORT
  VLC video stream port (internal).
  Default: 9897
  
--vlc-path=PATH
  Path to VLC executable. If provided the application will not extract VLC to the temp folder.
  Default: $TMPDIR/VLC.app/Contents/MacOS/VLC
  
--eyetv-port=PORT
  Port for EyeTV iPhone service.
  Default: 2170
```

## Running
Requires Node.JS
```
npm install
node app.js --vlc-path /Applications/VLC.app/Contents/MacOS/VLC
```

## Compiling portable executable
Will embed Node.JS and VLC binaries into one executable.
```
npm run build
```
## Run on boot
```
cp build/eyetv-iptv-server /usr/local/bin/
cp eyetv-iptv-server.plist ~/Library/LaunchAgents
```
