# BTC Tracker

A simple, powerful application to track your Bitcoin investments and monitor their performance over time.

## 🆕 What's New in v0.5.4

- **⚡ Satoshi Unit Support**: Full support for displaying Bitcoin amounts in Satoshis with proper symbol integration
- **💱 Enhanced Display Options**: BTC/Satoshi unit toggle with real-time switching across all views
- **🎨 Improved User Experience**: Dynamic labels and smart input validation based on selected unit
- **🐛 Critical Bug Fixes**: Resolved HTML encoding issues and improved settings synchronization
- **📈 Chart Library Update**: Switched to a more [** TradingVeiw lightweight **](https://github.com/tradingview/lightweight-charts)  charting library for better performance 
- **🌍 New Currencies**: Added support for Indian Rupee (INR) and Brazilian Real (BRL) with proper formatting and exchange rates
- **📦 Electron**: Enhanced Windows installer with integrated node modules, no more importing after installation
- **🔄 Synchronized Price Logic**: Unified price display and conversion across all views with real-time updates

[**📋 View Full Changelog**](CHANGELOG.md) | [**🚀 Release Notes**](.github/RELEASE_TEMPLATE.md)

## Documentation & Resources

- **📋 [Changelog](CHANGELOG.md)**: Detailed version history and release notes
- **🚀 [GitHub Pages](https://wilqq-the.github.io/BTC-Tracker/index.html)**: Comprehensive documentation with:
  - **Getting Started**: Detailed installation and setup instructions
  - **Screenshots**: See the application interface and features in action
  - **Features**: Complete overview of all BTC Tracker capabilities

## Why BTC Tracker?

I've created BTC Tracker because I needed a simpler solution for tracking Bitcoin investments. Existing applications were either too complex, designed for tracking entire portfolios, or difficult to configure.

Privacy was another major concern. I didn't want to share wallet addresses or transaction details with third-party services. BTC Tracker solves this by running locally and keeping all data on your machine.

The result is a focused tool that tracks Bitcoin investments while respecting privacy - no unnecessary features, no data sharing.

## Features

### 📊 **Data & Analytics**
- **Investment Tracking**: Record and manage your Bitcoin transactions
- **Enhanced Charts**: Interactive time slider, comparison ticker, and bottom timeline navigation
- **Yahoo Finance Integration**: Reliable data source for accurate price information
- **Performance Analysis**: Calculate P&L and ROI for your portfolio
- **Historical Data**: View Bitcoin price trends over time with enhanced visualization

### 💱 **Currency Support**
- **Multi-Currency Support**: Track investments in EUR, USD, PLN, GBP, JPY, CHF, **BRL (Brazilian Real)**
- **Bitcoin Unit Display**: Switch between BTC (decimal) and **Satoshis (whole numbers)** with proper ⚡ symbol
- **Advanced Currency Converter**: Enhanced exchange rate functionality with comprehensive testing
- **Smart Rate Caching**: Intelligent caching system for reliable currency conversion

### 🎨 **User Interface**
- **Responsive Design**: Enhanced mobile support with improved transaction interactions
- **Interactive Charts**: Advanced charting with time controls and comparison features
- **Dark/Light Theme**: Choose your preferred visual style
- **Mobile-First Design**: Optimized mobile transaction management and navigation

### 🔐 **Security & Authentication**
- **Secure Authentication**: User authentication with password protection and session management
- **Enhanced Session Management**: Improved startup and session handling
- **PIN Authentication**: Quick access with 4-digit PIN support

### 🔄 **Data Management**
- **CSV Import/Export**: Easy data migration with enhanced UI
- **Backup & Restore**: Comprehensive data backup solutions 
- **Transaction Validation**: Bitcoin precision validation (satoshi-level accuracy)

### 🚀 **Integration & Deployment**
- **Yahoo Finance Integration**: Reliable real-time price data with built-in rate limiting
- **Containerized**: Runs in Docker or Podman with minimal setup
- **Multi-Architecture Support**: Native ARM64, ARM/v7, and AMD64 support for Raspberry Pi, Umbrel, and x86 systems
- **Exchange Integration**: Automatic sync of BTC buy transactions with major exchanges (Binance, Coinbase, Kraken, Strike) using READ-ONLY API keys
- **Windows Desktop App**: Native Windows application with system tray support
- **Automated Dependencies**: Dependabot integration for automated security updates

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

## Umbrel Installation (One-Click)

BTC Tracker is available on the [Umbrel App Store](https://apps.umbrel.com/app/btctracker) for easy one-click installation on your Umbrel home server.

### Installing on Umbrel

1. Open the Umbrel App Store on your umbrelOS home server
2. Search for "BTC Tracker" or navigate to the Bitcoin category
3. Click "Install" to deploy BTC Tracker on your Umbrel node
4. Access the application through your Umbrel dashboard

**Benefits of running on Umbrel:**
- **Privacy-focused**: Runs locally on your own hardware
- **Bitcoin-native**: Perfect companion to your Bitcoin node
- **Self-sovereign**: Complete control over your data and privacy
- **Easy management**: Integrated with your Umbrel ecosystem

*Special thanks to [@dennysubke](https://github.com/dennysubke) for submitting BTC Tracker to the Umbrel App Store.*

## Quick Start 🚀

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

## Using Docker Hub Image Directly

You can also run BTC Tracker directly from Docker Hub without cloning the repository:

```bash
# Create a directory for your data
mkdir -p btc-tracker-data

# Run the container
docker run -d --name btc-tracker -p 3000:3000 -v "$(pwd)/data:/app/src/data" docker.io/thewilqq/btc-tracker:latest

# Access the application at http://localhost:3000
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
  - Yahoo Finance for BTC prices
  - ExchangeRate API for currency conversion
- Electron for running desktop version

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
- **[Umbrel App Store](https://apps.umbrel.com/app/btctracker)**: One-click installation on Umbrel OS - *submitted by [@dennysubke](https://github.com/dennysubke)*

## Author

wilqq-the

## Acknowledgements

- Bitcoin logo from the Bitcoin project
- Yahoo Finance for cryptocurrency price data and currency exchange rates

### Yahoo Finance Integration

The application uses Yahoo Finance to fetch Bitcoin price data. This provides reliable, real-time price information without requiring any API keys.

#### Price Data Features

- Real-time Bitcoin price data from Yahoo Finance
- Automatic rate limiting and caching for optimal performance
- Fallback mechanisms if the primary data source is unavailable
- Support for multiple currency pairs and conversions
- Historical price data for charting and analysis

#### Data Reliability

- Yahoo Finance provides enterprise-grade financial data
- Built-in rate limiting prevents service disruptions
- Smart caching reduces API calls while maintaining accuracy
- Automatic retry logic handles temporary outages