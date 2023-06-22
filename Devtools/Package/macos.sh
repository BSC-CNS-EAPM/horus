# Bash script for generating a macOS DMG.

# TEMPROARY DO NOT SET NOTARIZATION/SIGNING

# Remove any previous build in the dist/Package directory
rm -rf dist/Packages

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

# Create the package directory inside dist/
mkdir -p dist/Packages

# Create the macOS DMG
create-dmg --overwrite dist/Horus.app dist/Packages/

# Find the dmg file iside the Packages directory
dmg=$(find dist/Packages -name "*.dmg")

version="$version"

# Rename the dmg file
mv "$dmg" dist/Packages/Horus-$version.dmg