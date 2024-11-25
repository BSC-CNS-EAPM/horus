FROM --platform=x86_64 centos:7

# Basic config
RUN yum install -y yum-utils
RUN yum-config-manager --enable extras

# Install DNF
RUN yum install -y dnf

# Enable EPEL repo
RUN dnf install -y 'dnf-command(config-manager)'
# RUN dnf config-manager --set-enabled powertools
RUN dnf install -y epel-release

# Install basic dependencies
RUN dnf install -y \
    gcc \
    gcc-c++ \
    git \
    curl \
    redhat-lsb-core \
    zip \
    unzip \
    bzip2

# Install GTK even though on Rocky QT will be used
# RUN dnf install -y \
#     gobject-introspection-devel \
#     cairo-gobject-devel \
#     pkg-config \
#     gtk3-devel \
#     webkit2gtk3-devel \
#     libcanberra-gtk3 \
#     PackageKit-gtk3-module \
#     glib2-devel \
#     dbus-glib-devel

# QT
RUN dnf install -y python3-qt5

# Install rpm tools
# RUN dnf install -y rpmdevtools rpmlint

# Install micromamba
RUN curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xvj bin/micromamba

# Bun
RUN curl -fsSL https://bun.sh/install | bash

# Move the installation of bun from /root/.bun to /.bun
RUN mv /root/.bun /

# Add bun to PATH
ENV PATH /.bun/bin:$PATH

# Set the working directory in the container once everything is installed
WORKDIR /app

ENTRYPOINT [ "/bin/bash", "/app/Devtools/Docker/build_centos7.sh" ]
