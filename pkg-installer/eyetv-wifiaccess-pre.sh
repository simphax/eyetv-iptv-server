#!/bin/bash
pid=$(pgrep -o -x EyeTV)
kill $pid
while [ -e /proc/$var ]; do sleep 0.1; done
sudo -u $USER defaults write com.elgato.eyetv isWifiAccessEnabledLocal -bool true