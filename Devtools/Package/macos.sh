# Bash script for generating a macOS DMG.

# TEMPROARY DO NOT SET NOTARIZATION/SIGNING

# Remove any previous build in the dist/Package directory
rm -rf dist/Packages

# Get version from dist/Horus/APP_INFO
# APP_INFO is a file with APP_VERSION = x.x.x
version=$(cat dist/Horus.app/Contents/MacOS/APP_INFO | grep "APP_VERSION" | awk -F' = ' '{print $2}')

echo "Version: $version"

# Get the architecture of the system (Intel or Apple Silicon)
arch=$(uname -m)

# Create the package directory inside dist/
mkdir -p dist/Packages

# Create the macOS DMG
create-dmg --overwrite dist/Horus.app dist/Packages/

# Find the dmg file iside the Packages directory
dmg=$(find dist/Packages -name "*.dmg")

# Rename the dmg file
mv "$dmg" dist/Packages/Horus-$version-$arch.dmg

# Remove the Horus folder
rm -rf dist/Horus