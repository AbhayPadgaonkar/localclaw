# Use Node 22
FROM node:22-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (for faster builds)
COPY package*.json ./
RUN npm install

# Copy everything from your local folder into the container
# This includes the 'app' folder, 'next.config.ts', etc.
COPY . .

# Build the Next.js app
RUN npm run build

# Expose the Wizard UI port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]