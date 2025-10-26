# Changelog

All notable changes to the BTC Tracker project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.2] - 2025-10-21

### ✨ New Features
- **Zero-Cost Transaction Support** - Can now record Bitcoin received for free (mining rewards, gifts, airdrops, faucets)
  - Enter `0` for price when adding transactions
  - Cost basis correctly calculated as $0
  - Works with CSV import/export
  - UI helper text guides users
- **Configurable Duplicate Detection for CSV Import** - Added flexible duplicate detection system with 4 modes:
  - **Strict Mode**: All fields must match (date, amount, price, fees, currency, notes)
  - **Standard Mode** (Recommended): Core fields must match (date, type, amount, price)
  - **Loose Mode**: Only date and amount must match
  - **Off**: Import all transactions, including duplicates
- Enhanced import modal UI with expandable duplicate detection settings
- Better support for manual transaction entries and varied data formats
- Added 5 comprehensive CSV test files with documentation for testing duplicate detection modes
- Added customizable dashboard with drag-and-drop widgets (5 widgets: Chart, Transactions, Goals, Portfolio, DCA)
- Added Multi-Timeframe Performance widget
- Added Monthly Summary widget
- Added Bitcoin Goals & DCA Calculator with scenario projections
- Added DCA Performance Analysis with timing/consistency scoring
- Redesigned Analytics page with professional layout
- Added working CSV export for sell transactions (capital gains report)

### 🔧 Bug Fixes
- Fixed DCA analysis "What-If" scenarios crashing when zero-cost transactions (mining/gifts) are present - now correctly handles division by zero
- Fixed duplicate detection being too strict - was skipping legitimate transactions with same date/amount but different fees or notes
- Import now properly handles transactions recorded in separate rows with slight variations
- Fixed Goals page crash when accessing `is_on_track` property after importing transactions - added proper null checks for achieved/expired goals
- **Fixed average buy/sell price calculations to use volume-weighted averages** - Critical accuracy fix affecting:
  - Portfolio summary and widgets (was using simple average, now uses volume-weighted)
  - Transaction summary statistics (was using simple average, now uses volume-weighted)
  - Analytics win rate calculations (now correctly weights by transaction volume)
  - Chart tooltip for grouped transactions (now shows volume-weighted average price)
  - **Impact:** Fixes significant errors in P&L, ROI, and cost basis calculations, especially for users with varied transaction sizes
- Fixed mobile PIN login missing submit button and infinite retry loop
- Fixed currency conversion bugs in portfolio and transaction P&L calculations
- Fixed 24h portfolio change showing €0.00
- Fixed goals recalculation using wrong scenario growth rates
- Fixed DCA timing score being too harsh (38% below avg now scores 8.7/10 instead of 3.8/10)
- Fixed portfolio summary widget not showing unrealized P&L
- **Transaction History page does not show all transactions (#108)** - Added pagination system with configurable items per page
- **Current price data is not recalculated to main currency in DCA Calculator (#111)** - BTC price now converts from USD to user's main currency

## [0.6.0] - 2025-09-17

### 🚀 Complete Rewrite - Next.js Migration

This release marks a **complete rewrite** of BTC Tracker, migrating from the legacy Electron/Express architecture to a modern Next.js 15 stack. All legacy code has been removed in favor of a cleaner, faster, and more maintainable codebase.

### 🎯 Major Architecture Changes

#### **Technology Stack Overhaul**
- **Migrated to Next.js 15** with App Router for better performance and SEO
- **Replaced jsons with SQLite + Prisma ORM** for reliable data persistence
- **Removed Electron** to focus on web-first experience
- **TypeScript throughout** for type safety and better developer experience
- **React 18** with Server Components for optimal performance
- **Tailwind CSS** for modern, responsive styling

#### **New Features**
- **📥 Exchange CSV Import** with automatic format detection
  - Kraken, Binance, Coinbase, Strike support
  - Intelligent parser with confidence scoring
  - Bulk import capabilities
- **📈 Advanced Charting** powered by TradingView Lightweight Charts
  - Interactive candlestick, line, and area charts
  - Transaction markers with P&L visualization
  - Real-time price updates
- **👥 Multi-User Support** with complete data isolation
  - Individual user accounts with secure authentication
  - Admin panel for user management and system oversight
  - First user automatically becomes admin with user creation privileges
- **📊 Enhanced Analytics & Profile Pages**
  - Comprehensive analytics dashboard with monthly breakdowns and performance metrics
  - Professional user profile management with avatar support and PIN authentication
  - Advanced portfolio analytics with win/loss rates and holding period analysis
- **🔐 Enhanced Security**
  - NextAuth.js for authentication
  - Proper session management
  - Secure API routes with middleware protection
- **🌍 Improved Multi-currency Support**
  - Better exchange rate caching
  - Custom currency management
  - Automatic rate updates


#### **Performance Improvements**
- **Server-side rendering** for instant page loads
- **Optimized database queries** with Prisma

### 🔄 Migration Notes

⚠️ **Breaking Changes**: This version is NOT compatible with data from v0.5.x and earlier. Users must:
1. Export their transactions from the old version
2. Import them into v0.6.0 using the new CSV import feature

### 🐛 Bug Fixes
- Fixed all known currency conversion issues
- Resolved price update race conditions
- Fixed transaction form validation
- Corrected P&L calculations
- Fixed chart rendering issues

### 📝 Other Changes
- Updated all dependencies to latest versions
- Improved error handling throughout
- Better logging and debugging capabilities

---

## [0.5.3] - 2025-06-07 [LEGACY]

- **Lightning Network donation support** - Dual payment system with Lightning Network as default option for instant, low-fee donations alongside traditional on-chain Bitcoin payments

### Enhanced Currency Logging
- Added detailed currency exchange rate debugging and monitoring
- New debug modes: `./start.sh currency` for Yahoo Finance API logging
- Enhanced error handling and sequential fetching to prevent rate limiting
- Improved logging output with professional formatting (removed emojis)

---

## [0.5.2] - 2025-06-07 [LEGACY]

### 🚀 Major Fixes & Enhancements

#### 💱 **Currency System Overhaul**
- **Fixed critical exchange rate handling** issues affecting multi-currency conversions
- **Enhanced currency validation** with better error handling and fallback mechanisms
- **Improved server-side currency caching** with immediate cache refresh on settings changes
- **Resolved currency pairing issues** that caused "Missing USD/PLN" errors
- **Added comprehensive currency debugging** tools for administrators

#### 🎨 **UI/UX Critical Fixes**
- **Fixed dropdown display issues** in transaction forms (Type and Currency dropdowns)
- **Standardized modal styling** by copying working admin.html modal CSS to index.html
- **Improved quick-add transaction form** with proper spacing and visibility
- **Enhanced form field width** and layout for better usability
- **Fixed modal width and padding** for optimal dropdown display

#### 🎉 **Fun Features**
- **Added Bitcoin easter egg** - humorous validation messages when trying to add more than 21M BTC
- **Enhanced user experience** with witty messages for impossible transaction amounts
- **Automatic amount capping** to Bitcoin's maximum supply with educational feedback

### ✨ Features Enhanced

#### 🔄 **System Reliability**
- **Improved error handling** across currency conversion modules
- **Enhanced logging** for better debugging of exchange rate issues
- **Better cache invalidation** when currency settings change
- **Strengthened API fallback** mechanisms for currency data sources

#### 🛠️ **Developer Experience**
- **Enhanced debugging capabilities** for currency-related issues
- **Improved error messages** with more actionable feedback
- **Better system monitoring** for exchange rate fetch operations

### 🐛 Bug Fixes

- **Resolved dropdown text cutoff** in transaction forms
- **Fixed modal styling inconsistencies** between different pages
- **Corrected currency exchange rate** fetching and caching logic
- **Improved server startup** reliability with currency data initialization
- **Enhanced form validation** to prevent UI/UX issues

### 🔄 Technical Improvements

#### **Currency System**
- **Refactored exchange rate handling** with improved Yahoo Finance integration
- **Enhanced rate caching strategy** with intelligent cache refresh
- **Better error propagation** from server to client for currency issues
- **Improved rate validation** and compatibility checking

#### **UI Framework**
- **Standardized modal CSS** across all application pages
- **Improved responsive design** for transaction forms
- **Enhanced form field styling** with consistent appearance
- **Better dropdown functionality** with proper text display

### 📋 Migration Notes

- **Currency cache rebuild**: Existing exchange rate cache will be automatically refreshed
- **Modal styling**: Quick-add transaction form now uses improved admin panel styling
- **No data migration required**: All existing transactions and settings remain compatible

---

## [0.5.0] - 2025-06-07 [LEGACY]

### 🚀 Major Features Added

#### 📊 **Enhanced Chart & Data Visualization**
- **Changed data source to Yahoo Finance** for improved reliability and accuracy
- **Added interactive time slider** for dynamic chart navigation
- **Implemented comparison ticker** functionality for better market analysis
- **Enhanced chart display** with bottom timeline for easier time period selection
- **Improved chart responsiveness** and user interaction capabilities

#### 💱 **Brazilian Real (BRL) Currency Support**
- **Added full BRL support** to currency converter and exchange rate system
- **Enhanced PriceCache module** to handle BRL rates with proper validation
- **Updated CurrencyConverter** with comprehensive BRL integration
- **Improved currency exchange rate** error handling and fallback mechanisms

#### 🧪 **Testing Infrastructure Overhaul**
- **Refactored admin transaction tests** for improved reliability and error handling
- **Enhanced E2E test configuration** with better execution reliability
- **Added comprehensive currency converter tests** with Jest exit handling
- **Improved server readiness checks** in test suites
- **Enhanced cleanup processes** for test reliability

### ✨ Features Enhanced

#### 🎨 **UI/UX Improvements**
- **Enhanced transaction management** interface with improved mobile interactions
- **Fixed mobile transaction card** dropdown and interaction issues
- **Improved import/export functionality** with streamlined UI and better feedback
- **Enhanced transaction form validation** including Bitcoin precision validation
- **Fixed navigation dropdown z-index** issues for better layout consistency

#### 🔧 **Infrastructure & Development**
- **Added Dependabot configuration** for automated dependency updates
- **Enhanced logging implementation** across all server modules
- **Improved session management** and application startup reliability
- **Updated CI workflow** with better test configuration and coverage
- **Enhanced environment variable** handling for development workflows

#### 📱 **Mobile Responsiveness**
- **Improved mobile transaction** dropdown interactions
- **Enhanced responsive design** for all new chart features
- **Fixed mobile-specific UI** issues in transaction management
- **Better touch interaction** support for chart controls

### 🐛 Bug Fixes

- **Fixed mobile transaction card** interaction conflicts with filter/sort controls
- **Resolved navigation menu** display issues on mobile devices
- **Improved server startup** reliability with better error handling
- **Enhanced transaction dropdown** event handling to prevent conflicts
- **Fixed z-index layering** issues in navigation components

### 🔄 Technical Improvements

#### **Data & API**
- **Yahoo Finance integration** replaces previous data source
- **Enhanced currency rate caching** with intelligent fallback mechanisms
- **Improved API error handling** with retry logic and better user feedback
- **Enhanced price summary display** with multi-currency support

#### **Code Quality**
- **Refactored logging system** with consistent implementation across modules
- **Enhanced error handling** patterns throughout the application
- **Improved code organization** and module separation
- **Better testing patterns** and coverage for critical functionality

#### **Performance**
- **Optimized currency conversion** with improved caching strategies
- **Enhanced chart rendering** performance with new data source
- **Improved application startup** time and reliability
- **Better resource management** in testing and production environments

### 📋 Migration Notes

- **Data source migration**: Historical data will be refreshed from Yahoo Finance automatically
- **Currency cache refresh**: BRL support may require initial cache rebuild
- **No breaking changes**: All existing functionality remains compatible

### 🧪 Testing

- **Added 50+ new test cases** covering currency conversion functionality
- **Enhanced E2E test reliability** with improved error handling and cleanup
- **Comprehensive testing** for all new chart and currency features
- **Improved test execution** time and stability

---

## [0.4.2] - 2025-05-27 [LEGACY]

### Features Added
- Enhanced portfolio analytics
- Improved exchange rate handling
- Better error logging and debugging

### Bug Fixes
- Fixed transaction import issues
- Resolved mobile display problems
- Enhanced session management

---

## [0.4.1] - 2025-05-01 [LEGACY]

### Features Added
- PIN authentication system
- Enhanced mobile responsiveness
- Improved transaction validation

### Bug Fixes
- Fixed CSV import edge cases
- Resolved timezone handling issues
- Enhanced error messaging

---

## [0.4.0] - 2025-04-15 [LEGACY]

### Major Features Added
- Exchange integration (Binance, Coinbase, Kraken, Strike)
- Windows Desktop Application with system tray
- Enhanced security features
- Docker Hub image distribution

### Features Enhanced
- Improved user interface
- Better mobile support
- Enhanced authentication system

---

**Note**: This changelog was introduced with version 0.5.0. For changes prior to 0.4.0, please refer to the Git commit history.

---

## Legend

- 🚀 **Major Features** - Significant new functionality
- ✨ **Features Enhanced** - Improvements to existing features
- 🐛 **Bug Fixes** - Bug fixes and stability improvements
- 🔄 **Technical Improvements** - Under-the-hood improvements
- 📋 **Migration Notes** - Important information for updating
- 🧪 **Testing** - Testing-related improvements 