#!/bin/bash

# Bash script for generating a Linux packagem, both .deb and .rpm.

# Check if the script is being run as root.
if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

# Check if the script is being run from the root project directory
if [ ! -f "Devtools/Package/linux.sh" ]
  then echo "Please run from the root directory of the repository"
  exit
fi

# Detect where are we running the script in roder to build a .deb or .rpm
if [ -f "/etc/debian_version" ]
  then
    sh Devtools/Package/linux_deb.sh

elif [ -f "/etc/redhat-release" ]
  then
    sh Devtools/Package/linux_rpm.sh

else
  echo "Unsupported Linux distribution"
  exit
fi
