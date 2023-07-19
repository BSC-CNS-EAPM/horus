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



# Get the system architecture
arch=$(dpkg --print-architecture)

# Create the control file inside dist/linux/DEBIAN
cat > dist/linux/DEBIAN/control << EOF
Package: Horus
Version: $version
Architecture: $arch
Maintainer: Nostrum Biodiscovery it@nostrumbiodiscovery.com
Description: Horus visualizer and flow builder.
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

rm -f /usr/bin/Horus
rm -rf /usr/local/bin/Horus
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

echo "Creating the .deb file: Horus-$version-$branch-$arch.deb"

# Package the files into a .deb file
dpkg-deb --build dist/linux dist/Horus-$version-$branch-$arch.deb

# Create the Packages directory inside dist/
mkdir -p dist/Packages

echo "Moving the .deb file to dist/Packages"

# Move the .deb file to dist/Packages
mv dist/Horus-$version-$branch-$arch.deb dist/Packages

echo "Finished"

# Remove the temporary files
rm -rf dist/linux

# Create from the .deb file the .rpm file
echo "Creating the .rpm file: Horus-$version-$branch-$arch.rpm"

cd dist/Packages

sudo alien -r Horus-$version-$branch-$arch.deb --scripts

# Rename the .rpm file
mv *.rpm Horus-$version-$branch-$arch.rpm
