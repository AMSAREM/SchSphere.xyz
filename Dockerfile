# Stage 1: Build stage
FROM node:20-alpine AS builder

# Set working directory inside container
WORKDIR /app

# Copy dependency definition files first for better caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies) to allow building
RUN npm ci

# Copy the entire workspace to build the application
COPY . .

# Run the build process (produces dist/ folder containing built SPA and server.cjs)
RUN npm run build

# Stage 2: Runner stage
FROM node:20-alpine AS runner

# Set working directory inside container
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy dependency definition files
COPY package.json package-lock.json ./

# Install ONLY production dependencies since esbuild bundles server code but keeps node_modules external
RUN npm ci --only=production

# Copy the compiled production outputs from the builder stage
COPY --from=builder /app/dist ./dist

# Copy specific configuration files and local JSON data storage files required at runtime
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --from=builder /app/school_db_fallback.json ./school_db_fallback.json
COPY --from=builder /app/generated_licenses.json ./generated_licenses.json
COPY --from=builder /app/license_status.json ./license_status.json
COPY --from=builder /app/sync_logs.json ./sync_logs.json
COPY --from=builder /app/database.sql ./database.sql

# Expose the application port
EXPOSE 3000

# Start the full-stack server
CMD ["npm", "start"]
