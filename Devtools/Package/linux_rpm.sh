#!/bin/bash

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

# Get the system architecture
arch=$(dpkg --print-architecture)

# Set a filename variable
filename=Horus-$version-$branch-$arch

# Log the status
echo "Creating the .rpm file: $filename.rpm"

# Go to the dist folder
cd dist

# Create the file tree nedded to build RPM
# This creates the rpmbuild folder in the user's home directory
rpmdev-setuptree

# Move the compiled software into the SOURCES folder
mv Horus ~/rpmbuild/SOURCES/

# Create a .spec file
cat > ~/rpmbuild/SPECS/horus.spec << EOF
Name:           Horus
Version:        $version
Release:        1%{?dist}
Summary:        Molecular visualizer

License:        MIT
Source0:        Horus

%description
Horus visualizer and flow builder.

%prep
# No prep steps required

%build
# No build steps required

%install
# Remove the buildroot
rm -rf %{buildroot}
# Create the buildroot
mkdir -p %{buildroot}/%{_bindir}
# Copy the compiled software to the buildroot
cp -r %{_sourcedir}/Horus %{buildroot}/%{_bindir}

%files
%{_bindir}/Horus

%post
# Create a symlink to the executable
ln -s %{_bindir}/Horus/horus %{_bindir}/horus

%postun
rm -f %{_bindir}/horus
rm -rf %{_bindir}/Horus/

%changelog
# No changelog
EOF

# Build the package
echo "Building..."
rpmbuild -bb ~/rpmbuild/SPECS/horus.spec

# Move the generated .rpm package to dist/Packages
mkdir Packages

# Find the generated rpm file under ~/rpmbuild/RPMS/**/*.rpm
generated_rpm=$(find ~/rpmbuild/RPMS/ -name "*.rpm")

# Rename and move the generated .rpm file
mv $generated_rpm Packages/$filename.rpm

echo "Created $filename.rpm"

# Remove the rpmbuild folder
rm -rf ~/rpmbuild/


