#!/bin/bash

# Get version from dist/Horus/APP_INFO
# APP_INFO is a file with APP_VERSION = x.x.x
version=$(cat dist/Horus/APP_INFO | grep "APP_VERSION" | awk -F' = ' '{print $2}')

echo "Version: $version"

# Get the system architecture (we are in RHEL/CentOS, so it will always be x86_64)
arch=$(uname -m)

# Get the system name (el8, ubuntu, etc)
system=$(lsb_release -is)

# Set a filename variable
filename=Horus-$version-$arch-$system-QT5

# Go to the dist folder
cd dist

# # Log the status
# echo "Creating the .rpm file: $filename.rpm"

# # Create the file tree nedded to build RPM
# # This creates the rpmbuild folder in the user's home directory
# rpmdev-setuptree

# # Copy the compiled software into the SOURCES folder
# cp -r Horus ~/rpmbuild/SOURCES/

# # Ignore RPATH
# export QA_SKIP_RPATHS=1

# # Create a .spec file
# cat > ~/rpmbuild/SPECS/horus.spec << EOF
# Name:           Horus
# Version:        $version
# Release:        1%{?dist}
# Summary:        Molecular visualizer

# License:        MIT
# Source0:        Horus

# %description
# Horus visualizer and flow builder.

# %prep
# # No prep steps required

# %build
# # No build steps required

# %install
# # Remove the buildroot
# rm -rf %{buildroot}
# # Create the buildroot
# mkdir -p %{buildroot}/%{_bindir}
# # Copy the compiled software to the buildroot
# cp -r %{_sourcedir}/Horus %{buildroot}/%{_bindir}

# %files
# %{_bindir}/Horus

# %post
# # Create a symlink to the executable
# ln -s %{_bindir}/Horus/horus %{_bindir}/horus

# %postun
# rm -f %{_bindir}/horus
# rm -rf %{_bindir}/Horus/

# %changelog
# # No changelog
# EOF

# # Build the package
# echo "Building..."
# rpmbuild -bb ~/rpmbuild/SPECS/horus.spec

# # Find the generated rpm file under ~/rpmbuild/RPMS/**/*.rpm
# generated_rpm=$(find ~/rpmbuild/RPMS/ -name "*.rpm")

# # Rename and move the generated .rpm file
# mv $generated_rpm $filename.rpm

# echo "Created $filename.rpm"

# # Remove the rpmbuild folder
# rm -rf ~/rpmbuild/

echo "Removing libstdc++.so.6 from the bundle (issue #68)"

# The library is in the _internal folder of the bundle
# Removed to avoid conflicts between this library and the system one

# TODO: Use internal PIP so that we don't need to do this, as the
# dependencies will be compiled with the internal libstdc++.so.6
rm -rf Horus/_internal/libstdc++.so.6

# # Zip the Horus folder
# zip -rq $filename.zip Horus

# # Remove the Horus folder
# rm -rf Horus/

echo "Finished"

