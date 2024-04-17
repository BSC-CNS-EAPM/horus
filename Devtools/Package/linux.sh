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

version=$(cat dist/Horus/APP_INFO | grep "APP_VERSION" | awk -F' = ' '{print $2}')

# Detect where are we running the script in order to build a .deb or .rpm
if [ -f "/etc/debian_version" ]
  then
    
    # If we are on ubuntu 22, we can build a .deb
    if [ -f "/etc/lsb-release" ]
      then
        osName=$(cat /etc/lsb-release | grep "DISTRIB_CODENAME" | awk -F'=' '{print $2}')
        if [ $osName = "jammy" ]
          then
          osName="Ubuntu22"
            sh Devtools/Package/linux_deb.sh
        elif [ $osName = "trusty" ]
          then
          osName="Other-Debian"
        else
          echo "Unsupported Ubuntu version"
          exit
        fi
    else
      echo "Unsupported Ubuntu version"
      exit
    fi

elif [ -f "/etc/redhat-release" ]
  then

    osName=$(cat /etc/os-release | grep "ID" | awk -F'=' '{print $2}')

    if [ $osName = "rocky" ]
    then
      osName="Rocky"
    else [ $osName = "centos" ]
      osName="CentOS"
    fi

    sh Devtools/Package/linux_rpm.sh

else
  echo "Other Linux distribution"
  osName="Other"
fi

# Create a new folder called Horus-$version-Linux-$osName
mkdir -p "dist/Horus-$version-$osName"

# Move the deb, the .hp files and the python wheel (.whl) to the new folder
if [ $osName = "Ubuntu22" ]
  then
    mv dist/*.deb "dist/Horus-$version-$osName"
else
    mv dist/Horus "dist/Horus-$version-$osName"
fi

mv dist/*.whl "dist/Horus-$version-$osName"

# Create a tar.gz file of the folder
cd dist && tar -czvf "Horus-$version-$osName.tar.gz" "Horus-$version-$osName/"

# Remove the folder
rm -rf "Horus-$version-$osName/"

