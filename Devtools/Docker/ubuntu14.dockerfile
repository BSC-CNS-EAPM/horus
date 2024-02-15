FROM --platform=x86_64 ubuntu:14.04

# Set some non-interactive environment variables
RUN export DEBIAN_FRONTEND=noninteractive
RUN export TZ=Etc/UTC

# Update cache and install dependencies
RUN apt-get update --no-install-recommends -y

# Install basic dependencies
RUN apt-get install -y \
curl \
zip \
bzip2 \
git \
gcc \
g++

# Install micromamba
RUN curl -Ls http://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xvj bin/micromamba

# Cannot install nodejs on Ubuntu 14.04, we rely on previous builds of Horus for the GUI

# Set the working directory in the container
WORKDIR /app

ENTRYPOINT [ "/bin/bash", "/app/Devtools/Docker/build_ubuntu14.sh" ]