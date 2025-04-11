# Running BTC Tracker with Docker/Podman

This document explains how to run the BTC Tracker application using containers.

## Configuration

The application can be configured using environment variables in the `.env` file:

- `CONTAINER_NAME`: Name of the container (default: btc-tracker)
- `PORT`: Port to expose the application (default: 3000)
- `DATA_PATH`: Path to the data directory to mount (default: ./src/data)
- `NODE_ENV`: Node environment (default: production)

## Using Docker Compose / Podman Compose

1. Configure your settings in the `.env` file
2. Build the image: `docker-compose build` or `podman-compose build`
3. Run the container: `docker-compose up -d` or `podman-compose up -d`
4. Stop the container: `docker-compose down` or `podman-compose down`

## Using Native Docker / Podman Commands

If you prefer to use native commands:

```bash
# Build the image
podman build -t btc-tracker .

# Run the container
podman run -d --name btc-tracker \
  -p 3000:3000 \
  -v ./src/data:/app/src/data \
  btc-tracker
```

## Accessing the Application

Once running, access the application at: http://localhost:3000

## Data Persistence

The application data is stored in the mounted volume. Make sure to back up your data regularly. 