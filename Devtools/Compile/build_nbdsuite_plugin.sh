#!/bin/bash

# Build and zip the NBDsuite plugin (without the dependencies!)

# Go to the nbdsuite directory
cd AppSupport/Plugins/NBDSuite

echo "Building NBDSuite plugin..."

echo "Compiling the view..."
npm run parcel-nbdsuite

# Zip the plugin
zip -rq NBDSuite.hp . -x *.DS_Store -x '*__pycache__*' -x 'dev/*' -x 'config/*' 

# Go back to the root directory
cd ../../..

app_version=$(cat dist/Horus/APP_INFO | grep "APP_VERSION" | awk -F' = ' '{print $2}')

# Get the plugin version from AppSupport/Plugins/nbdsuite/plugin.meta
plugin_version=$(cat AppSupport/Plugins/NBDSuite/plugin.meta | grep "version" | awk -F'"' '{print $4}')

echo "Plugin version: $plugin_version"
echo "App version: $app_version"

version="$plugin_version-Horus-$app_version"

echo "Final version: $version"

# Get also the kernel name (darwin or linux)
kernel=$(uname -s | tr '[:upper:]' '[:lower:]')

# Finally get the architecture
arch=$(uname -m)

# Create the dist directory if it doesn't exist
mkdir -p dist

# Move the plugin to the dist directory
mv AppSupport/Plugins/NBDSuite/NBDSuite.hp dist/NBDSuite-$version-$kernel-$arch.hp

# Build the NBDSuite Pro plugin

# Go to the nbdsuite directory
cd AppSupport/Plugins/NBDSuitePro

echo "Building NBDSuite Pro plugin..."

# Zip the plugin
zip -rq NBDSuite-Pro.hp . -x *.DS_Store -x '*__pycache__*' -x 'dev/*' -x 'config/*' 

# Go back to the root directory
cd ../../..

# Get the version from plugin.meta
version=$(cat AppSupport/Plugins/NBDSuitePro/plugin.meta | grep "version" | awk -F'"' '{print $4}')

echo "Version: $version"

version="$version-horus-$app_version"

# Get also the kernel name (darwin or linux)
kernel=$(uname -s | tr '[:upper:]' '[:lower:]')

# Finally get the architecture
arch=$(uname -m)

# Create the dist directory if it doesn't exist
mkdir -p dist

# Move the plugin to the dist directory
mv AppSupport/Plugins/NBDSuitePro/NBDSuite-Pro.hp dist/NBDSuite-Pro-$version-$kernel-$arch.hp