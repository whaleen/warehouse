# Use Playwright's official image which includes browsers
FROM mcr.microsoft.com/playwright:v1.50.1-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Expose port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production

# Run the service
CMD ["npm", "start"]
