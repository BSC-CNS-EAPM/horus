#!/bin/bash

# Remove the GUI caches
rm -rf build .parcel-cache .pytest_cache

# Remove the docs
rm -rf HorusAPI/docs/build/*

# Remove the stubs
rm -rf HorusAPI/stubs

# Remove the generated .c files
find App Server HorusAPI -name "*.c" -type f -delete

# Remove the Horus plugin deps
# in the AppSupport/DefaultPlugins/Horus/deps directory
rm -rf AppSupport/DefaultPlugins/Horus/deps