# Stage 1: Build Stage
FROM node:18-bullseye AS builder

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Create and set permissions for temp directory
RUN mkdir -p /tmp/apt/lists/partial && \
    chmod 1777 /tmp

# Update and install system dependencies with error handling
RUN apt-get clean && \
    apt-get update -y && \
    apt-get install -y --no-install-recommends \
    curl \
    zip \
    git \
    gcc \
    g++ \
    libgirepository1.0-dev \
    libglib2.0-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Micromamba
RUN curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xvj bin/micromamba

# Set the working directory
WORKDIR /app

# Copy necessary build files
COPY . /app

# Run build script
RUN chmod +x /app/Devtools/Docker/build_ubuntu22.sh
RUN /app/Devtools/Docker/build_ubuntu22.sh

# Make sure the binary is executable in the builder stage
RUN chmod +x /app/dist/Horus/Horus

# Stage 2: Runtime Stage
FROM mambaorg/micromamba:latest

# Switch to root temporarily for setup
USER root

# Set the working directory
WORKDIR /app

# Create directory with proper permissions
RUN mkdir -p /bin/Horus

# Copy the built application from the builder stage
COPY --from=builder /app/dist/Horus /bin/Horus

# Set the entrypoint to your application
ENTRYPOINT ["/bin/Horus/Horus"]

# Optional: Use CMD for default arguments if needed
CMD ["-s", "-h", "0.0.0.0", "-V"]