#!/bin/bash

# Remove the GUI caches
rm -rf build .parcel-cache .pytest_cache

# Remove the docs
rm -rf HorusAPI/docs/build/*

# Remove the stubs
rm -rf HorusAPI/stubs

# Remove the generated .C files
rm -rf HorusAPI/src/*.c

# Remove the Horus plugin deps
# in the AppSupport/DefaultPlugins/Horus/deps directory
rm -rf AppSupport/DefaultPlugins/Horus/deps