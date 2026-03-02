# ------------- Stage 1 — Builder Stage -------------

# Use the official Node.js image as the base image for the builder stage
FROM node:24-alpine AS builder

# Set the working directory in the container (inside the docker container, not the host machine)
WORKDIR /app

# Copy the shared event-bus FIRST so npm can find it
COPY shared ./shared

# Build the shared library first (this will create the dist directory with the compiled code)
WORKDIR /app/shared/event-bus
RUN npm install
RUN npm run build

# Move back into the microservice directory
WORKDIR /app/services/career-service

# Copy package.json and package-lock.json to the working directory
COPY services/career-service/package*.json ./

# Install dependencies (including dev dependencies for building)
RUN npm install

# Copy the rest of the application code to the working directory
COPY services/career-service ./

# Build the application (this will create the dist directory with the compiled code)
RUN npm run build



# -------------- Stage 2 — Production Stage -------------

# Use a smaller Node.js image for the production stage
FROM node:24-alpine

# Set the working directory in the container
WORKDIR /app/services/career-service

# Copy the shared library (needed at runtime by the event-bus)
COPY --from=builder /app/shared /app/shared

# Copy only the necessary files from the builder stage to the production stage
COPY --from=builder /app/services/career-service/dist ./dist

# Copy package.json and package-lock.json to the working directory
COPY services/career-service/package*.json ./

# Install only production dependencies (omit dev dependencies)
RUN npm install --omit=dev

# Run the application using the compiled code in the dist directory
CMD ["node", "dist/index.js"]