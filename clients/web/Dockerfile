# ------------- Stage 1 — Builder Stage -------------

# Use the official Node.js image as the base image for the builder stage
FROM node:24-alpine AS builder

# Set the working directory in the container (inside the docker container, not the host machine)
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY clients/web/package*.json ./

# Install dependencies (including dev dependencies for building)
RUN npm install

# Copy the rest of the application code to the working directory
COPY clients/web ./

# Declare build arguments
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_MAX_ALLOWED_FILES
ARG VITE_MAX_IMAGE_SIZE_MB
ARG VITE_MAX_ALLOWED_CHARACTERS
ARG VITE_FEED_LIMIT

# Make them available as env vars during build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_MAX_ALLOWED_FILES=$VITE_MAX_ALLOWED_FILES
ENV VITE_MAX_IMAGE_SIZE_MB=$VITE_MAX_IMAGE_SIZE_MB
ENV VITE_MAX_ALLOWED_CHARACTERS=$VITE_MAX_ALLOWED_CHARACTERS
ENV VITE_FEED_LIMIT=$VITE_FEED_LIMIT

# Build the application (this will create the dist directory with the compiled code)
RUN npm run build


# -------------- Stage 2 — Production Stage -------------

# Use a smaller Node.js image for the production stage
FROM nginx:stable-alpine

# We copy ONLY the final built files from the first stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the custom Nginx configuration file to the appropriate location in the container:
COPY clients/web/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for the Nginx server
EXPOSE 80

# Run Nginx in the foreground (this is necessary for the container to keep running)
CMD ["nginx", "-g", "daemon off;"]