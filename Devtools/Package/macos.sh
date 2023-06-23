# Bash script for generating a macOS DMG.

# TEMPROARY DO NOT SET NOTARIZATION/SIGNING

# Remove any previous build in the dist/Package directory
rm -rf dist/Packages

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

# Get the version from package.json
version=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')

echo "Version: $version"

version="$version"

# Create the package directory inside dist/
mkdir -p dist/Packages

# Create the macOS DMG
create-dmg --overwrite dist/Horus.app dist/Packages/

# Find the dmg file iside the Packages directory
dmg=$(find dist/Packages -name "*.dmg")

# Rename the dmg file
mv "$dmg" dist/Packages/Horus-$version-$branch.dmg