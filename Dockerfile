# Use Node 22 Alpine for a smaller, faster image
FROM node:22-alpine

WORKDIR /app

# 🟢 1. Copy only package files to cache dependencies
COPY package*.json ./

# 🟢 2. Install dependencies (this layer is cached unless package.json changes)
# 🟢 Use --legacy-peer-deps to bypass the nodemailer conflict
RUN npm install --legacy-peer-deps

# 🟢 3. Copy the rest of the source code
COPY . .

# 🟢 4. Build the Next.js app
RUN npm run build

EXPOSE 3000

# 🟢 5. Push schema changes and start
# This ensures that 'last_heartbeat_at' exists in your local DB
CMD ["sh", "-c", "npx drizzle-kit push && npm start"]