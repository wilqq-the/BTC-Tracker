// BTC-USD and BTC-EUR price scraper
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Ensure directory exists
const dataDir = path.join(__dirname, '../src/data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Convert date string to timestamp in milliseconds
function convertTimestamp(dateStr) {
  return new Date(dateStr).getTime();
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Get historical data from Yahoo Finance API
async function fetchHistoricalData(symbol, period = '10y', interval = '1d') {
  // Calculate start and end dates
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (10 * 365 * 24 * 60 * 60); // 10 years ago in seconds
  
  try {
    // Yahoo Finance API v8 endpoint 
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await axios.get(url, {
      params: {
        period1: startDate,
        period2: endDate,
        interval: interval,
        events: 'history',
        includeAdjustedClose: true
      }
    });
    
    if (response.data && response.data.chart && 
        response.data.chart.result && 
        response.data.chart.result[0]) {
      
      const result = response.data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      // Process data and create a map with date as key
      const data = {};
      timestamps.forEach((timestamp, i) => {
        if (quotes.close[i] !== null) {
          const date = formatDate(new Date(timestamp * 1000));
          data[date] = {
            date,
            timestamp: timestamp * 1000,
            close: quotes.close[i]
          };
        }
      });
      
      return data;
    }
    
    throw new Error('Invalid data format received');
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error.message);
    return {};
  }
}

// Main function to download and format BTC data
async function downloadCryptoData() {
  console.log("Downloading BTC data for last 10 years...");
  
  try {
    // Download BTC-USD and BTC-EUR data
    const [btcUsdData, btcEurData] = await Promise.all([
      fetchHistoricalData('BTC-USD'),
      fetchHistoricalData('BTC-EUR')
    ]);
    
    console.log(`USD data entries: ${Object.keys(btcUsdData).length}`);
    console.log(`EUR data entries: ${Object.keys(btcEurData).length}`);
    
    // Find common dates (intersection)
    const usdDates = new Set(Object.keys(btcUsdData));
    const eurDates = new Set(Object.keys(btcEurData));
    const commonDates = [...usdDates].filter(date => eurDates.has(date)).sort();
    
    console.log(`Common dates found: ${commonDates.length}`);
    
    if (commonDates.length === 0) {
      throw new Error('No common dates found between USD and EUR data');
    }
    
    // Create the formatted data structure
    const formattedData = commonDates.map(date => ({
      date,
      priceEUR: btcEurData[date].close,
      timestamp: convertTimestamp(date),
      priceUSD: btcUsdData[date].close,
      price: btcEurData[date].close // The existing data uses EUR as the default price
    }));
    
    // Save to JSON file
    const outputFile = path.join(dataDir, 'btc_historical_10y.json');
    fs.writeFileSync(outputFile, JSON.stringify(formattedData, null, 2));
    
    console.log(`Data saved to ${outputFile}`);
    console.log(`Total records: ${formattedData.length}`);
    
    return formattedData;
  } catch (error) {
    console.error('Error in downloadCryptoData:', error.message);
    return [];
  }
}

// Run the scraper
downloadCryptoData();

module.exports = { downloadCryptoData }; 