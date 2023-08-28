#!/bin/bash

# Build and zip the NBDsuite plugin (without the dependencies!)

# Go to the nbdsuite directory
cd AppSupport/Plugins/NBDSuite

echo "Building NBDSuite plugin..."

# Zip the plugin
zip -rq NBDSuite.hp . -x *.DS_Store -x '*__pycache__*' -x 'dev/*' -x 'config/*' 

# Go back to the root directory
cd ../../..

# Get version from git tag or branch name
if [ -z "$1" ]
    then
        echo "Using latest git tag or branch name"
        branch=$(git describe --tags --abbrev=0 2>/dev/null)
        if [ -z "$branch" ]
            then
                branch=$(git symbolic-ref -q --short HEAD)
                branch="$branch-$(git rev-parse --short HEAD)"
        fi
    else
        branch=$1
fi

branch="$branch"

echo "Branch: $branch"

# Get the version from AppSupport/Plugins/nbdsuite/plugin.meta.json
version=$(cat AppSupport/Plugins/NBDSuite/plugin.meta | grep "version" | awk -F'"' '{print $4}')

echo "Version: $version"

version="$version"

# Get also the kernel name (darwin or linux)
kernel=$(uname -s | tr '[:upper:]' '[:lower:]')

# Finally get the architecture
arch=$(uname -m)

# Create the dist directory if it doesn't exist
mkdir -p dist

# Move the plugin to the dist directory
mv AppSupport/Plugins/NBDSuite/NBDSuite.hp dist/NBDSuite-$version-$branch-$kernel-$arch.hp

# Build the NBDSuite Pro plugin

# Go to the nbdsuite directory
cd AppSupport/Plugins/NBDSuitePro

echo "Building NBDSuite Pro plugin..."

# Zip the plugin
zip -rq NBDSuite-Pro.hp . -x *.DS_Store -x '*__pycache__*' -x 'dev/*' -x 'config/*' 

# Go back to the root directory
cd ../../..

# Get version from git tag or branch name
if [ -z "$1" ]
    then
        echo "Using latest git tag or branch name"
        branch=$(git describe --tags --abbrev=0 2>/dev/null)
        if [ -z "$branch" ]
            then
                branch=$(git symbolic-ref -q --short HEAD)
                branch="$branch-$(git rev-parse --short HEAD)"
        fi
    else
        branch=$1
fi

branch="$branch"

echo "Branch: $branch"

# Get the version from plugin.meta
version=$(cat AppSupport/Plugins/NBDSuitePro/plugin.meta | grep "version" | awk -F'"' '{print $4}')

echo "Version: $version"

version="$version"

# Get also the kernel name (darwin or linux)
kernel=$(uname -s | tr '[:upper:]' '[:lower:]')

# Finally get the architecture
arch=$(uname -m)

# Create the dist directory if it doesn't exist
mkdir -p dist

# Move the plugin to the dist directory
mv AppSupport/Plugins/NBDSuitePro/NBDSuite-Pro.hp dist/NBDSuite-Pro-$version-$branch-$kernel-$arch.hp