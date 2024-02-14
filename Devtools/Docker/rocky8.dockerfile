FROM --platform=x86_64 rockylinux:8.6

# Set the working directory in the container
WORKDIR /app

# Enable EPEL repo
RUN dnf install -y 'dnf-command(config-manager)'
RUN dnf config-manager --set-enabled powertools
RUN dnf install -y epel-release

# Install basic dependencies
RUN dnf install -y \
    gcc \
    gcc-c++ \
    git \
    curl \
    redhat-lsb-core \
    zip

# Install GTK even though on Rocky QT will be used
RUN dnf install -y \
    gobject-introspection-devel \
    cairo-gobject-devel \
    pkg-config \
    gtk3-devel \
    webkit2gtk3-devel \
    libcanberra-gtk3 \
    PackageKit-gtk3-module \
    glib2-devel \
    dbus-glib-devel

# QT
RUN dnf install -y python3-qt5

# Install rpm tools
RUN dnf install -y rpmdevtools rpmlint

# Install miniconda
RUN curl -LO https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
RUN bash Miniconda3-latest-Linux-x86_64.sh -b -p /opt/conda
RUN rm Miniconda3-latest-Linux-x86_64.sh
RUN echo "source /opt/conda/etc/profile.d/conda.sh" >> ~/.bashrc
RUN echo "conda activate base" >> ~/.bashrc

# Activate conda environment to check conda installation
RUN . /opt/conda/etc/profile.d/conda.sh && conda init && conda activate base

# Setup ENV variables for conda
ENV PATH /opt/conda/bin:$PATH

# NodeJS 18
RUN dnf module install -y nodejs:18

ENTRYPOINT [ "/bin/bash", "/app/Devtools/Docker/build_rocky8.sh" ]
