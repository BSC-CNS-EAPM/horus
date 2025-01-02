FROM --platform=x86_64 ubuntu:22.04

# Set some non-interactive environment variables
RUN export DEBIAN_FRONTEND=noninteractive
RUN export TZ=Etc/UTC

# Update cache and install dependencies
RUN apt-get update --no-install-recommends -y

# Install basic dependencies
RUN apt-get install -y \
curl \
zip \
git \
gcc \
g++

# GTK4 (updated ubuntu requires GTK4 instead of GTK3)
RUN apt install -y \
libgirepository1.0-dev \
gir1.2-gtk-4.0 \
gir1.2-webkit2-4.0 \
libgtk-4-dev \
libglib2.0-dev

# Install micromamba
RUN curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xvj bin/micromamba

# NodeJS 18, needed to fix parcel runtime
RUN apt-get install -y ca-certificates curl gnupg
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN NODE_MAJOR=18 && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN apt-get update
RUN apt-get install nodejs -y

# Set the working directory in the container
WORKDIR /app

ENTRYPOINT [ "/bin/bash", "/app/Devtools/Docker/build_ubuntu22.sh" ]