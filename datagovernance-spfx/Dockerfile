# Use Node.js 18 LTS for SPFx compatibility
FROM node:18.17.1-alpine

# Set working directory
WORKDIR /workspace

# Install build dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy project files
COPY . .

# Build the project
RUN npm run build && npm run ship

# The output will be in /workspace/sharepoint/solution/
CMD ["echo", "Build complete. Check ./sharepoint/solution/ for .sppkg file"]
