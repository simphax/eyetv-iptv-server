#!/bin/bash
sudo -u $USER launchctl unload /Library/LaunchAgents/eyetv-iptv-server.plist
rm /Library/LaunchAgents/eyetv-iptv-server.plist
rm /usr/local/bin/eyetv-iptv-server