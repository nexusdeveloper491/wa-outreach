# Use Node.js 20 LTS lightweight image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package metadata first to optimize layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start server
CMD ["node", "server.js"]
