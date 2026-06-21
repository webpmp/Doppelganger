# Multi-stage build for Doppelganger
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the client and server assets
RUN npm run build

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy the built assets from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 3000

# Set environment variable to production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "run", "start"]
