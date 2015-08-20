# eyetv-iptv-server
EyeTV->IPTV server for Kodi

Can be compiled into standalone application.

Needs to be run on same machine as the EyeTV application, and it needs to be activated for iPhone access.

## Command line args
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
```
node app.js --vlc-path /Applications/VLC.app/Contents/MacOS/VLC
```

## Compiling portable executable
```
npm install
npm run build
```
