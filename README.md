# BTC Tracker

A simple, powerful application to track your Bitcoin investments and monitor their performance over time.

## GH Pages

Our [GitHub Pages documentation site](https://wilqq-the.github.io/BTC-Tracker/index.html) provides comprehensive information about BTC Tracker:
- **🚀 Getting Started**: Detailed installation and setup instructions
- **📸 Screenshots**: See the application interface and features in action
- **⭐ Features**: Complete overview of all BTC Tracker capabilities

## Why BTC Tracker?

I've created BTC Tracker because I needed a simpler solution for tracking Bitcoin investments. Existing applications were either too complex, designed for tracking entire portfolios, or difficult to configure.

Privacy was another major concern. I didn't want to share wallet addresses or transaction details with third-party services. BTC Tracker solves this by running locally and keeping all data on your machine.

The result is a focused tool that tracks Bitcoin investments while respecting privacy - no unnecessary features, no data sharing.

## Features

- **Investment Tracking**: Record and manage your Bitcoin transactions
- **Multi-Currency Support**: Track investments in EUR, USD, PLN, GBP, JPY, CHF
- **Performance Analysis**: Calculate P&L and ROI for your portfolio
- **Historical Data**: View Bitcoin price trends over time
- **Responsive Design**: Works on desktop and mobile devices
- **CSV Import/Export**: Easy data migration
- **Dark/Light Theme**: Choose your preferred visual style
- **Secure Authentication**: User authentication with password protection and session management
- **CoinGecko API Integration**: Optional API key support for higher rate limits
- **Containerized**: Runs in Docker or Podman with minimal setup
- **Exchange Integration**: Automatic sync of BTC buy transactions with major exchanges (Binance, Coinbase, Kraken, Strike) using READ-ONLY API keys
- **Windows Desktop App**: Native Windows application with system tray support and automatic updates

## Quick Start (Easiest Method) 🚀

1. Clone the repository:
   ```
   git clone https://github.com/wilqq-the/BTC-tracker.git
   cd BTC-tracker
   ```

2. Run the setup script:
   ```
   chmod +x run-app.sh
   ./run-app.sh
   ```

3. Open your browser and navigate to `http://localhost:3000`

That's it! The script automatically:
- Detects if you have Docker or Podman installed
- Pulls the latest image from Docker Hub
- Runs the application
- Persists your data between runs

### Running the Development Image

If you want to run the development version with the latest features:

#### Using the run-app.sh Script

```bash
chmod +x run-app.sh
./run-app.sh --dev
```

This will:
- Pull the `dev` tagged image instead of `latest`
- Run the container with name `btc-tracker-dev`

#### Using Docker Compose Directly

```bash
# Set the environment variables
export IMAGE_TAG=dev
export CONTAINER_NAME=btc-tracker-dev

# Run with docker-compose
docker-compose up -d

# Or with podman-compose
podman-compose up -d
```

You can also modify these settings in a `.env` file:
```
IMAGE_TAG=dev
CONTAINER_NAME=btc-tracker-dev
```

## Windows Installation (Electron App)

### Installing from Executable

1. Download the latest `BTC-Tracker-Setup.exe` from the [Releases](https://github.com/wilqq-the/BTC-tracker/releases) page
2. Run the installer and follow the installation wizard
3. Launch BTC Tracker from your Start Menu or Desktop shortcut

**Note:** On first launch, the application will unpack Node.js binaries using Command Prompt or PowerShell. This is a one-time process and may take a few moments. A command window will briefly appear and close automatically once complete.

The application data is stored in:
- `%APPDATA%\BTC-Tracker` (User settings and data)
- `%LOCALAPPDATA%\BTC-Tracker` (Application files)


Your data persists between application updates and can be backed up by copying the above directories.

## Using Docker Hub Image Directly

You can also run BTC Tracker directly from Docker Hub without cloning the repository:

```bash
# Create a directory for your data
mkdir -p btc-tracker-data

# Run the container
docker run -d --name btc-tracker -p 3000:3000 -v "$(pwd)/data:/app/src/data" docker.io/thewilqq/btc-tracker:latest

# Access the application at http://localhost:3000
```

To update to the latest version:

```bash
docker pull docker.io/thewilqq/btc-tracker:latest
docker stop btc-tracker
docker rm btc-tracker
docker run -d --name btc-tracker -p 3000:3000 -v "$(pwd)/data:/app/src/data" docker.io/thewilqq/btc-tracker:latest
```

## Alternative Installation Methods

### Standard Installation

1. Clone the repository:
   ```
   git clone https://github.com/wilqq-the/BTC-tracker.git
   cd BTC-tracker
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the application:
   ```
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Manual Docker/Podman Installation

See [DOCKER.md](DOCKER.md) for detailed instructions on running with Docker or Podman manually.

## Usage

### First-Time Setup

When you first run the application, you'll be prompted to create an administrator account. This account will be used to access the application and manage your data.

### Authentication

- **Login**: Access the application using your username and password
- **Remember Me**: Option to stay logged in for 30 days
- **Password Change**: Change your password through the Admin Panel
- **PIN Change**: Change your PIN Code through the Admin Panel
- **Session Management**: Sessions automatically expire after 24 hours (or 30 days with Remember Me)
- **Security**: Passwords are securely hashed and stored using bcryptjs

### Adding Transactions

1. Navigate to the Admin Panel
2. Upload a CSV file with your transaction data or use the template
3. Your transactions will appear in the Transactions page
4. You can also sync transactions directly from exchante (for non Kraken Pro, Coinbase Pro, Binance and Strike are supported)

### Viewing Portfolio Performance

The Dashboard provides an overview of:
- Current BTC holdings
- Total investment cost
- Current portfolio value
- Profit & Loss (P&L)
- Historical performance chart

### Managing Settings

1. Navigate to the Admin Panel
2. Select your preferred currency settings
3. (Optional) Add your CoinGecko API key for better rate limits and reliability
   - Get a free API key at [CoinGecko](https://www.coingecko.com/en/api/pricing)
   - This allows up to 10,000 calls per month instead of the default 10-30 calls per minute

## Data Storage

All data is stored locally in JSON files within the `/src/data` directory and persists between application restarts. Depending on method of running this directory can be mapped in several ways.

The Windows application stores data in:
```
%APPDATA%\btc-tracker-data     # Application data
%APPDATA%\btc-tracker\extracted     # Extracted server files
%APPDATA%\btc-tracker\btc-tracker.log     # Log file
```


## Technologies Used

- Node.js and Express for the backend
- Vanilla JavaScript for the frontend
- Chart.js for data visualization
- Passport.js for authentication
- Bcrypt for secure password hashing
- Express Session for session management
- External APIs:
  - CoinGecko API for BTC prices
  - ExchangeRate API for currency conversion
- Electron for running desktop version

## Development

### Project Structure

```
BTC-tracker/
├── src/
│   ├── public/           # Frontend files
│   ├── server/           # Backend modules
│   ├── data/             # Data storage
│   └── server.js         # Main server file
├── Dockerfile
├── docker-compose.yml
├── run-app.sh            # Easy setup script
├── package.json
└── README.md
```

## License

MIT

## Resources

- **[GitHub Repository](https://github.com/wilqq-the/BTC-tracker)**: Source code and project files
- **[Documentation](https://wilqq-the.github.io/BTC-tracker/)**: Comprehensive guides and screenshots
- **[Docker Hub](https://hub.docker.com/r/thewilqq/btc-tracker)**: Pre-built Docker images

## Author

wilqq-the

## Acknowledgements

- Bitcoin logo from the Bitcoin project
- CoinGecko for cryptocurrency price data
- ExchangeRate API for currency conversions

### CoinGecko API Integration

The application uses CoinGecko's API to fetch Bitcoin price data. By default, it uses the free tier which has rate limitations.

#### Adding Your CoinGecko API Key

1. Navigate to the Admin Panel
2. In the settings section, enter your CoinGecko API key
3. Click "Test Key" to verify it works correctly
4. Save your settings

#### How to Get a CoinGecko API Key

1. Visit [CoinGecko API Pricing](https://www.coingecko.com/en/api/pricing)
2. Sign up for the "Demo" plan (free, no credit card required)
3. Copy your API key that starts with "CG-"

#### API Key Usage Notes

- Demo API keys (starting with "CG-") are passed as URL query parameters (`x_cg_demo_api_key`)
- This increases your rate limit from approximately 10-30 calls/minute to 10,000 calls/month
- The app will automatically handle correctly formatting API requests with your key
- If no API key is provided, the application uses the standard free tier endpoint 
- For exchanges use **READONLY** API keys for security reasons
