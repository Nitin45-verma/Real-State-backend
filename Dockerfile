# Use official lightweight Node.js Alpine image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads

# Expose backend port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Command to run backend
CMD ["npm", "start"]
