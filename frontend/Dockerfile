FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the Vite default port
EXPOSE 5173

# Run Vite development server, binding to all interfaces so it's accessible from host
CMD ["npm", "run", "dev", "--", "--host"]
