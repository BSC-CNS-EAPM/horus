#!/bin/bash

# Remove the GUI
rm -rf build GUI .parcel-cache .pytest_cache AppSupport/Plugins/NBDSuite/Pages/*

# Remove the docs
npm run doc-clean

# Remove the stubs
rm -rf HorusAPI/stubs

# Remove the generated .C files
rm -rf HorusAPI/src/*.c

# Remove NBDSuite plugin deps (except for nbdsuite)
# in the AppSupport/Plugins/NBDSuite/deps directory
cd AppSupport/Plugins/NBDSuite/deps
find . -maxdepth 1 -not -name 'nbdsuite*' -not -name "." -not -name ".." -exec rm -rf {} +
cd ../../../../

# Remove the Horus plugin deps
# in the AppSupport/DefaultPlugins/Horus/deps directory
rm -rf AppSupport/DefaultPlugins/Horus/deps