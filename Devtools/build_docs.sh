#!/bin/bash

# Copy the latest logo
cp Resources/horus.png HorusAPI/docs/source/_static/horus.png

cd HorusAPI/docs && make html