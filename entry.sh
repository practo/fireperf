#!/bin/bash

set -xe

export LIGHTHOUSE_CHROMIUM_PATH=${LIGHTHOUSE_CHROMIUM_PATH:-/usr/bin/google-chrome}
export DISPLAY=${DISPLAY-:99}

sudo chown -Rv 1000:100 /tmp/chrome-data

exec supervisord &

export LIGHTHOUSE_CHROMIUM_PATH=/usr/bin/google-chrome

sleep 6

node /app/index.js
