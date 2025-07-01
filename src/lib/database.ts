import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'bitcoin-tracker.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to Bitcoin Tracker SQLite database');
    // Auto-initialize on connection
    initializeDatabase()
      .then(() => {
        console.log('Database auto-initialization completed');
        // Run database migrations
        return runMigrations();
      })
      .then(() => {
        console.log('Database migrations completed');
        // Start Bitcoin price scheduler after database is ready
        startPriceScheduler();
      })
      .catch((error) => {
        console.error('Database auto-initialization failed:', error);
      });
  }
});

// Create basic tables if they don't exist
export const initializeDatabase = () => {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      // Bitcoin transactions table - stores only original transaction data
      db.run(`CREATE TABLE IF NOT EXISTS bitcoin_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
        btc_amount REAL NOT NULL,
        
        -- Original transaction data (what user actually entered)
        original_price_per_btc REAL NOT NULL,
        original_currency TEXT NOT NULL,
        original_total_amount REAL NOT NULL,
        
        -- Fees and metadata
        fees REAL DEFAULT 0,
        fees_currency TEXT DEFAULT 'USD',
        transaction_date DATETIME NOT NULL,
        notes TEXT,
        
        -- Tracking
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error creating bitcoin_transactions table:', err);
          reject(err);
          return;
        }
      });

      // Historical Bitcoin prices (daily OHLC data for long-term trends)
      db.run(`CREATE TABLE IF NOT EXISTS bitcoin_price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE UNIQUE NOT NULL,
        open_usd REAL NOT NULL,
        high_usd REAL NOT NULL,
        low_usd REAL NOT NULL,
        close_usd REAL NOT NULL,
        volume REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error creating bitcoin_price_history table:', err);
          reject(err);
          return;
        }
      });

      // Intraday Bitcoin prices (5-10 minute intervals for current day and recent activity)
      db.run(`CREATE TABLE IF NOT EXISTS bitcoin_price_intraday (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME UNIQUE NOT NULL,
        price_usd REAL NOT NULL,
        volume REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error creating bitcoin_price_intraday table:', err);
          reject(err);
          return;
        }
      });

             // Index for better query performance
       db.run(`CREATE INDEX IF NOT EXISTS idx_history_date ON bitcoin_price_history(date)`);
       db.run(`CREATE INDEX IF NOT EXISTS idx_intraday_timestamp ON bitcoin_price_intraday(timestamp)`);

      // Exchange rates cache for currency conversion
      db.run(`CREATE TABLE IF NOT EXISTS exchange_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_currency TEXT NOT NULL,
        to_currency TEXT NOT NULL,
        rate REAL NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_currency, to_currency)
      )`, (err) => {
        if (err) {
          console.error('Error creating exchange_rates table:', err);
          reject(err);
          return;
        }
      });

      // App settings table
      db.run(`CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        settings_data TEXT NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        version TEXT NOT NULL DEFAULT '1.0.0'
      )`, (err) => {
        if (err) {
          console.error('Error creating app_settings table:', err);
          reject(err);
          return;
        }
      });

      // Users table for authentication
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        pin_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          reject(err);
          return;
        }
      });

      // Custom currencies table for user-defined currencies
      db.run(`CREATE TABLE IF NOT EXISTS custom_currencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error creating custom_currencies table:', err);
          reject(err);
        } else {
          console.log('Bitcoin tracker database tables initialized successfully');
          resolve();
        }
      });

      // Create bitcoin_current_price table for storing current price with daily changes
      db.run(`
        CREATE TABLE IF NOT EXISTS bitcoin_current_price (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          price_usd REAL NOT NULL,
          price_change_24h_usd REAL DEFAULT 0,
          price_change_24h_percent REAL DEFAULT 0,
          timestamp TEXT NOT NULL,
          source TEXT DEFAULT 'api',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating bitcoin_current_price table:', err);
        } else {
          console.log('Bitcoin current price table created successfully');
        }
      });

      // Create portfolio_summary table for storing pre-calculated portfolio data
      db.run(`
        CREATE TABLE IF NOT EXISTS portfolio_summary (
          id INTEGER PRIMARY KEY DEFAULT 1,
          
          -- Holdings
          total_btc REAL NOT NULL DEFAULT 0,
          total_transactions INTEGER NOT NULL DEFAULT 0,
          
          -- Investment (in user's main currency)
          total_invested REAL NOT NULL DEFAULT 0,
          total_fees REAL NOT NULL DEFAULT 0,
          average_buy_price REAL NOT NULL DEFAULT 0,
          main_currency TEXT NOT NULL DEFAULT 'USD',
          
          -- Current Value (updated with each price change)
          current_btc_price_usd REAL NOT NULL DEFAULT 0,
          current_portfolio_value REAL NOT NULL DEFAULT 0,
          
          -- P&L (in main currency)
          unrealized_pnl REAL NOT NULL DEFAULT 0,
          unrealized_pnl_percent REAL NOT NULL DEFAULT 0,
          
          -- 24h Changes (in main currency)
          portfolio_change_24h REAL NOT NULL DEFAULT 0,
          portfolio_change_24h_percent REAL NOT NULL DEFAULT 0,
          
          -- Secondary currency display values
          secondary_currency TEXT NOT NULL DEFAULT 'EUR',
          current_value_secondary REAL NOT NULL DEFAULT 0,
          
          -- Metadata
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_price_update DATETIME DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT single_row CHECK (id = 1)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating portfolio_summary table:', err);
        } else {
          console.log('Portfolio summary table created successfully');
          
          // Initialize with default row if doesn't exist
          db.run(`
            INSERT OR IGNORE INTO portfolio_summary (id) VALUES (1)
          `, (insertErr) => {
            if (insertErr) {
              console.error('Error initializing portfolio summary:', insertErr);
            } else {
              console.log('Portfolio summary initialized');
            }
          });
        }
      });


    });
  });
};

// Run database migrations to add missing columns to existing tables
export const runMigrations = () => {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      // Migration 1: Add pin_hash column to users table if it doesn't exist
      db.run(`ALTER TABLE users ADD COLUMN pin_hash TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding pin_hash column:', err);
          reject(err);
          return;
        } else if (!err) {
          console.log('Added pin_hash column to users table');
        }
        resolve();
      });
    });
  });
};

// Dynamic import to avoid circular dependency
async function startPriceScheduler() {
  try {
    const { PriceScheduler } = await import('./price-scheduler');
    PriceScheduler.start();
    console.log('Bitcoin price scheduler started automatically');
    
    // Initialize core main currency exchange rates (USD ↔ EUR)
    const { ExchangeRateService } = await import('./exchange-rate-service');
    await ExchangeRateService.ensureMainCurrencyRates();
    
    // Also start the historical data service
    const { HistoricalDataService } = await import('./historical-data-service');
    await HistoricalDataService.initialize();
  } catch (error) {
    console.error('Failed to start Bitcoin price scheduler:', error);
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
  }
} 