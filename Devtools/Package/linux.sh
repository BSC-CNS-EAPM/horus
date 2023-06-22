# Bash script for generating a Linux-Debian package.

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

# Create the linux package directory inside dist/
mkdir -p dist/linux

# Create the DEBIAN directory inside dist/linux
mkdir -p dist/linux/DEBIAN

# Get version from git tag or branch name
if [ -z "$1" ]
    then
        echo "No version supplied, using latest git tag or branch name"
        version=$(git describe --tags --abbrev=0 2>/dev/null)
        if [ -z "$version" ]
            then
                version=$(git symbolic-ref -q --short HEAD)
                version="$version-$(git rev-parse --short HEAD)"
        fi
    else
        version=$1
fi

# Create the control file inside dist/linux/DEBIAN
cat > dist/linux/DEBIAN/control << EOF
Package: Horus
Version: $1
Architecture: amd64
Maintainer: Nostrum Biodiscovery it@nostrumbiodiscovery.com
Description: Horus visualizer and flow builder.
EOF

# Create a postinst script inside dist/linux/DEBIAN
cat > dist/linux/DEBIAN/postinst << EOF
#!/bin/bash

ln -s /usr/local/bin/horus /usr/bin/horus
EOF

# Create a postrm script inside dist/linux/DEBIAN
cat > dist/linux/DEBIAN/postrm << EOF
#!/bin/bash

rm -f /usr/bin/horus
EOF

# Create the usr directory inside dist/linux
mkdir -p dist/linux/usr

# Create the local directory inside dist/linux/usr
mkdir -p dist/linux/usr/local

# Create the bin directory inside dist/linux/usr/local
mkdir -p dist/linux/usr/local/bin

# Create the Horus directory inside dist/linux/usr/local/bin
mkdir -p dist/linux/usr/local/bin/Horus

# Copy the horus binaies to dist/linux/usr/local/bin
cp -r dist/Horus dist/linux/usr/local/bin/Horus

version="$version"

# Package the files into a .deb file
dpkg-deb --build dist/linux dist/Horus-$version.deb

# Remove the temporary files
rm -rf dist/linux