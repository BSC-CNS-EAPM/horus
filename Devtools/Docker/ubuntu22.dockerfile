FROM --platform=x86_64 ubuntu:22.04

# Setup the ENV for conda
ENV PATH /opt/conda/bin:$PATH

# Set the working directory in the container
WORKDIR /app

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

# Install miniconda
RUN curl -LO https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
RUN bash Miniconda3-latest-Linux-x86_64.sh -b -p /opt/conda
RUN rm Miniconda3-latest-Linux-x86_64.sh
RUN echo "source /opt/conda/etc/profile.d/conda.sh" >> ~/.bashrc
RUN echo "conda activate base" >> ~/.bashrc

# Activate conda environment and install requirements
RUN . /opt/conda/etc/profile.d/conda.sh && conda init && conda activate base

# Setup ENV variables for conda
ENV PATH /opt/conda/bin:$PATH

RUN apt-get install -y ca-certificates curl gnupg
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN NODE_MAJOR=18 && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN apt-get update
RUN apt-get install nodejs -y

ENTRYPOINT [ "/bin/bash", "/app/Devtools/Docker/build_ubuntu22.sh" ]