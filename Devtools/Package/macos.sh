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

# Move the Horus.app inside the package directory
mv dist/Horus.app dist/Packages

# Remove any .DS_Store files inside the bundle (included with the DefaultIcon)
find dist/Packages/Horus.app -name '*.DS_Store' -exec rm {} \;

# Remove any previous signing
codesign --remove-signature dist/Packages/Horus.app

# Codesign the .app bundle
codesign --deep -s "CAD497EE3E18DA164E232E36F1B86B3572EDC768" "dist/Packages/Horus.app"

# Define the name
name="Horus-$version-$arch.dmg"

# Create the dmg file
create-dmg \
  --volname "Horus" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --volicon "Resources/horus_volume.icns" \
  --icon "Horus.app" 200 190 \
  --hide-extension "Horus.app" \
  --app-drop-link 600 185 \
  --background "Resources/nostrum_color.png" \
  --codesign "CAD497EE3E18DA164E232E36F1B86B3572EDC768" \
  "dist/$name" \
  "dist/Packages"

# Move the conents of the dist/Packages directory to dist/
mv dist/Packages/* dist/

# Remove the Packages directory
rm -rf dist/Packages