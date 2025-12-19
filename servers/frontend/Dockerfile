FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Set environment variables to allow external access
ENV DANGEROUSLY_DISABLE_HOST_CHECK=true
ENV WDS_SOCKET_PORT=0

# Start development server
CMD ["npm", "start"]
