# Use an official Node.js image
FROM node:20

# Set the working directory
WORKDIR /app

# Install yarn globally (if missing)
RUN corepack enable

# Copy package.json and yarn.lock first (to cache dependencies)
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the app
COPY . .

# Build the app (if necessary)
RUN yarn build

# Expose the port
EXPOSE 3000

# Start the app
CMD ["yarn", "start"]
