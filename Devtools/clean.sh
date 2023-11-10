#!/bin/bash

# Remove the GUI
rm -rf build GUI .parcel-cache .pytest_cache

# Remove the docs
npm run doc-clean

# Remove the stubs
rm -rf HorusAPI/stubs

# Remove the generated .C files
rm -rf HorusAPI/src/*.c

# Remove the Horus plugin deps
# in the AppSupport/DefaultPlugins/Horus/deps directory
rm -rf AppSupport/DefaultPlugins/Horus/deps