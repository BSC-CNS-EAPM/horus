#!/bin/bash

# This script will automatically build the docker images and push them to the docker hub
# if you are not Christian Dominguez, please do not use this script!

echo "Building and pushing Horus Docker images"
echo "If you are not Christian Dominguez, please do not use this script and cancel it now"

# Wait 5 seconds
sleep 5

echo "Hello Christian, let's start building and pushing the images"

# Build Rocky 8
docker build -t horus_rocky -f Devtools/Docker/rocky8.dockerfile .

# Push Rocky 8
docker tag horus_rocky chdominguez/horus_rocky
docker push chdominguez/horus_rocky

# Build Ubuntu 22
docker build -t horus_ubuntu -f Devtools/Docker/ubuntu22.dockerfile .

# Push Ubuntu 22
docker tag horus_ubuntu chdominguez/horus_ubuntu
docker push chdominguez/horus_ubuntu

# Build Linux Universal
docker build -t horus_universal -f Devtools/Docker/ubuntu14.dockerfile .

# Push Linux Universal
docker tag horus_universal chdominguez/horus_universal
docker push chdominguez/horus_universal