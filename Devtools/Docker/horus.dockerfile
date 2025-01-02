# Stage 1: Build Stage
FROM node:18-bullseye AS builder

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Add permissions to the tmp folder
RUN mkdir -p /tmp && chmod 777 /tmp

# Update and install system dependencies with error handling
RUN apt-get update -y && \
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

# Copy necessary build files (adjust as needed)
COPY . /app

# Run build script (ubuntu22 script is fine for now)
RUN chmod +x /app/Devtools/Docker/build_ubuntu22.sh
RUN /app/Devtools/Docker/build_ubuntu22.sh

# Stage 2: Runtime Stage
FROM mambaorg/micromamba:latest

# Set the working directory
WORKDIR /app

# Copy the built application from the builder stage
COPY --from=builder /app/dist/Horus /bin/Horus

# Ensure the application is executable
RUN chmod +x /bin/Horus/Horus

# Set the entrypoint to your application
ENTRYPOINT ["/bin/Horus/Horus"]

# Optional: Use CMD for default arguments if needed
CMD ["-s", "-h", "0.0.0.0" "-V"]