# eyetv-iptv-server
EyeTV->IPTV server

Provides an interface for an IPTV frontend to stream EyeTV channels, for example Kodi's IPTV Simple PVR Client. It provides a m3u8 playlist with url's to stream uncompressed EyeTV live channels.

## Setup
EyeTV will first need to be installed to the same machine as eyetv-iptv-server.

An installer can be found in [releases](https://github.com/simphax/eyetv-iptv-server/releases). It will install the [EyeTV capture plugin](http://www.videolan.org/vlc/download-eyetv.html), activate EyeTV's iPhone access and set **eyetv-iptv-server** to run at login.

After installation set the IPTV client to use **http://localhost:9898/playlist.m3u8** as the M3U playlist. 

## Command-line arguments
Arguments can be added to **/Library/LaunchAgents/eyetv-iptv-server.plist**
```
--port=PORT
  Server port.
  Default: 9898
  
--host=IP
  Server host. Set this to localhost if the IPTV should only be accessible locally.
  Default: 0.0.0.0
  
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

## Running from source
Requires [Node.JS](https://nodejs.org/) and [EyeTV](https://www.geniatech.eu/eyetv/support/eyetv-3-en/) with [EyeTV capture plugin](http://www.videolan.org/vlc/download-eyetv.html) and [iPhone access](https://www.geniatech.eu/eyetv/faq/how-do-i-use-eyetv-for-ipad/) enabled.
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
cp eyetv-iptv-server.plist /Library/LaunchAgents/
launchctl load /Library/LaunchAgents/eyetv-iptv-server.plist
```
## Changelog
### v1.0.1
- Restricted internal video stream to localhost
- Added --host argument

### v1.0.0
First release
