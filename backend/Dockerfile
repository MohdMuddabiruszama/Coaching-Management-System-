# ─────────────────────────────────────────────────────
# ZF Solution Backend — Production Dockerfile
# Multi-stage build for minimal image size (~120MB)
# ─────────────────────────────────────────────────────

# Stage 1: Install production dependencies only
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Stage 2: Production image
FROM node:18-alpine AS runner
WORKDIR /app

# Security: create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

# Copy production dependencies from Stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Remove dev/test files from final image
RUN rm -rf tests coverage .env .env.test .env.example \
    jest.config.js .eslintrc.* *.md

# Create uploads directory (if needed by the app)
RUN mkdir -p uploads && chown nodeuser:nodejs uploads

# Switch to non-root user
USER nodeuser

# Expose application port
EXPOSE 5000

# Health check — hits the existing /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:5000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
