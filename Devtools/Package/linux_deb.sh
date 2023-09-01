#!/bin/bash

# Bash script for generating a Linux-Debian package.

# Create the linux package directory inside dist/
mkdir -p dist/linux

# Create the DEBIAN directory inside dist/linux
mkdir -p dist/linux/DEBIAN

# Get version from dist/Horus/APP_INFO
# APP_INFO is a file with APP_VERSION = x.x.x
version=$(cat dist/Horus/APP_INFO | grep "APP_VERSION" | awk -F' = ' '{print $2}')

echo "Version: $version"

version="$version"

# Get the system architecture
arch=$(dpkg --print-architecture)

# Get the system name (el8, ubuntu, etc)
system=$(lsb_release -is)

# Set a filename variable
filename=Horus-$version-$arch-$system

# Create the control file inside dist/linux/DEBIAN
cat > dist/linux/DEBIAN/control << EOF
Package: Horus
Version: $version
Architecture: $arch
Maintainer: Nostrum Biodiscovery it@nostrumbiodiscovery.com
Description: g
EOF

# Create a postinst script inside dist/linux/DEBIAN
cat > dist/linux/DEBIAN/postinst << EOF
#!/bin/bash

ln -s /usr/local/bin/Horus/Horus /usr/bin/horus
EOF

# Add the required permissions to the postinst script
chmod 775 dist/linux/DEBIAN/postinst

# Create a postrm script inside dist/linux/DEBIAN
cat > dist/linux/DEBIAN/postrm << EOF
#!/bin/bash

rm /usr/bin/horus
rm -r /usr/local/bin/Horus
EOF

# Add the required permissions to the postrm script
chmod 775 dist/linux/DEBIAN/postrm

# Create the usr directory inside dist/linux
mkdir -p dist/linux/usr

# Create the local directory inside dist/linux/usr
mkdir -p dist/linux/usr/local

# Create the bin directory inside dist/linux/usr/local
mkdir -p dist/linux/usr/local/bin

# Create the Horus directory inside dist/linux/usr/local/bin
mkdir -p dist/linux/usr/local/bin/Horus

# Copy the horus binaies to dist/linux/usr/local/bin
cp -r dist/Horus/* dist/linux/usr/local/bin/Horus/

echo "Creating the .deb file: $filename.deb"

# Package the files into a .deb file
dpkg-deb --build dist/linux dist/$filename.deb

# Remove the temporary files
rm -rf dist/linux

# Zip the Horus folder
cd dist

# Zip the Horus folder
zip -rq $filename.zip Horus/

# Remove the Horus folder
rm -rf Horus/

echo "Finished"