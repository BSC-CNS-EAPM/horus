# Bash script for generating a macOS DMG.

# TEMPROARY DO NOT SET NOTARIZATION/SIGNING

# Remove any previous build in the dist/Package directory
rm -rf dist/Packages

# Get version from dist/Horus/APP_INFO
# APP_INFO is a file with APP_VERSION = x.x.x
version=$(cat dist/Horus.app/Contents/MacOS/APP_INFO | grep "APP_VERSION" | awk -F' = ' '{print $2}')

echo "Version: $version"

# Get the architecture of the system (Intel or Apple Silicon)
# Use the output of the python platform.machine() function
# as the macOS build will be all made in Apple Silicon but using a Rosseta environment
arch=$(python -c "import platform; print(platform.machine())")

# Create the package directory inside dist/
mkdir -p dist/Packages

# Move the Horus.app inside the package directory
mv dist/Horus.app dist/Packages

# Remove any .DS_Store files inside the bundle (included with the DefaultIcon)
find dist/Packages/Horus.app -name '*.DS_Store' -exec rm {} \;

# Remove any previous signing
codesign --remove-signature dist/Packages/Horus.app

# Get the Apple Development signing identity (Code number)
identity=$(security find-identity -v -p codesigning | grep "Apple" | awk -F' "' '{print $1}' | awk -F') ' '{print $2}')

# Codesign the .app bundle if a signing identity is found
if [[ -n "$identity" ]] && [[ "$identity" != "" ]]; then
  codesign --force --deep --sign "$identity" dist/Packages/Horus.app
else
  echo "WARNING: No signing identity found, skipping codesigning. This may cause issues with macOS Gatekeeper."
fi

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
  --background "Resources/bsc_logo.png" \
  $(if [[ -n "$identity" ]] && [[ "$identity" != "" ]]; then echo "--codesign \"$identity\""; fi) \
  "dist/$name" \
  "dist/Packages"

# Move the conents of the dist/Packages directory to dist/
mv dist/Packages/* dist/

# Remove the Packages directory
rm -rf dist/Packages

# If arch is x86_64, set osName to "Intel", if arm64, set osName to "AppleSilicon"
osName="Unknown"
if [ "$arch" = "x86_64" ]; then
  osName="Intel"
elif [ "$arch" = "arm64" ]; then
  osName="AppleSilicon"
fi

# Create a new folder called Horus-$version-macOS-$osName
mkdir -p "dist/Horus-$version-macOS-$osName"

# Move the dmg, the .hp files and the python wheel (.whl) to the new folder
mv "dist/$name" "dist/Horus-$version-macOS-$osName"
mv dist/*.hp "dist/Horus-$version-macOS-$osName"
mv dist/*.whl "dist/Horus-$version-macOS-$osName"

# Create a zip file of the folder
cd dist && zip -r "Horus-$version-macOS-$osName.zip" "Horus-$version-macOS-$osName"
