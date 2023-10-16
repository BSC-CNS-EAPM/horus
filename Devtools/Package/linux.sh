#!/bin/bash

# Bash script for generating a Linux packagem, both .deb and .rpm.

# Check if the script is being run as root.
if [ "$EUID" -ne 0 ]
  then echo "Script running without superuser privileges. Things may fail."
fi

# Check if the script is being run from the root project directory
if [ ! -f "Devtools/Package/linux.sh" ]
  then echo "Please run from the root directory of the repository"
  exit
fi

# Detect where are we running the script in roder to build a .deb or .rpm
if [ -f "/etc/debian_version" ]
  then
    osName="Ubuntu"
    sh Devtools/Package/linux_deb.sh

elif [ -f "/etc/redhat-release" ]
  then
    osName="Rocky"
    sh Devtools/Package/linux_rpm.sh

else
  echo "Unsupported Linux distribution"
  exit
fi

version=$(cat dist/Horus/APP_INFO | grep "APP_VERSION" | awk -F' = ' '{print $2}')

# Create a new folder called Horus-$version-Linux-$osName
mkdir -p "dist/Horus-$version-$osName"

# Move the deb, the .hp files and the python wheel (.whl) to the new folder
mv "dist/$name" "dist/Horus-$version-$osName"
mv dist/*.hp "dist/Horus-$version-$osName"
mv dist/*.whl "dist/Horus-$version-$osName"

# Detect where are we running the script in order to build a .deb or .rpm
if [ -f "/etc/debian_version" ]
  then
    osName="Ubuntu"
    sh Devtools/Package/linux_deb.sh

elif [ -f "/etc/redhat-release" ]
  then
    osName="Rocky"
    sh Devtools/Package/linux_rpm.sh

else
  echo "Unsupported Linux distribution"
  exit
fi

# Create a tar.gz file of the folder
cd dist && tar -czvf "Horus-$version-$osName.tar.gz" "Horus-$version-$osName"

