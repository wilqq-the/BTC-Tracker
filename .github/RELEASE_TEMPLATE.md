# 🚀 BTC Tracker v0.5.0 - Major Platform Enhancements

## 🌟 **What's New**

### 📊 **Enhanced Charts & Data**
- **📈 Interactive time slider** for dynamic chart navigation
- **🔄 Comparison ticker** functionality for market analysis  
- **📅 Bottom timeline** for easier period selection
- **🏦 Yahoo Finance integration** for reliable data sourcing

### 💱 **New Currency Support**
- **🇧🇷 Brazilian Real (BRL)** now fully supported
- **⚡ Enhanced currency converter** with comprehensive testing
- **🗄️ Smart rate caching** for reliable conversion

### 🎨 **UI/UX Improvements**
- **📱 Enhanced mobile support** with improved transaction interactions
- **🖱️ Better touch controls** for chart navigation
- **📋 Streamlined import/export** interface
- **✅ Bitcoin precision validation** (satoshi-level accuracy)

### 🧪 **Testing & Reliability**
- **🔧 Refactored test suite** with improved reliability
- **📊 Comprehensive currency testing** with 50+ new test cases
- **⚙️ Enhanced error handling** and debugging capabilities

## 🐛 **Bug Fixes**

- Fixed mobile transaction card interaction conflicts
- Resolved navigation dropdown z-index issues  
- Improved server startup reliability
- Enhanced transaction form validation

## 🔄 **Technical Improvements**

- **🤖 Dependabot integration** for automated security updates
- **📝 Enhanced logging** across all modules
- **🔐 Improved session management** and startup
- **⚡ Better performance** for chart rendering and currency conversion

## 📋 **Migration Notes**

- **No breaking changes** - all existing functionality preserved
- Historical data will refresh automatically from Yahoo Finance
- Currency cache will rebuild to include BRL support

## 🚀 **Installation**

### Quick Start (Docker)
```bash
git clone https://github.com/wilqq-the/BTC-tracker.git
cd BTC-tracker
./run-app.sh
```

### Windows Desktop App
Download `BTC-Tracker-Setup-0.5.0.exe` from the assets below.

### Docker Hub
```bash
docker run -d --name btc-tracker -p 3000:3000 \
  -v "$(pwd)/data:/app/src/data" \
  docker.io/thewilqq/btc-tracker:0.5.0
```

## 📊 **Full Changelog**

See [CHANGELOG.md](https://github.com/wilqq-the/BTC-tracker/blob/main/CHANGELOG.md) for detailed technical changes.

---

**Enjoy the enhanced BTC tracking experience! 📈✨** 