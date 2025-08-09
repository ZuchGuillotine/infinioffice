# Multi-stage build for InfiniOffice
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install backend dependencies
RUN npm ci --only=production

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm ci --only=production

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files and dependencies
COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm ci

# Copy source code
COPY . .

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs --shell /bin/sh infinioffice

# Copy built application
COPY --from=deps --chown=infinioffice:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=infinioffice:nodejs /app/src ./src
COPY --from=builder --chown=infinioffice:nodejs /app/frontend/dist ./frontend/dist
COPY --from=builder --chown=infinioffice:nodejs /app/prisma ./prisma
COPY --chown=infinioffice:nodejs package*.json ./

# Install Prisma client
RUN npx prisma generate

# Switch to non-root user
USER infinioffice

# Expose port (App Runner will set PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Start command
CMD ["npm", "start"]