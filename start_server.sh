#!/bin/bash

docker rm -f horus-download

docker build -t horus-download .

docker run -d --name horus-download -p 3000:3000 --restart=always horus-download
