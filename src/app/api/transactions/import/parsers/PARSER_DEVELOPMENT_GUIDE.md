# 📊 Exchange Parser Development Guide

## 🎯 Overview
This guide explains how to add support for new cryptocurrency exchanges to the Bitcoin Tracker import system. The parser system automatically detects exchange formats and converts transaction data to a standardized format.

---

## 🏗️ Parser Architecture

### Current Implementation
The parser system is located in `src/app/api/transactions/import/parsers/` and consists of:

```
parsers/
├── index.ts           # Main parser orchestrator
├── kraken.ts          # Kraken exchange parser
├── binance.ts         # Binance exchange parser  
├── coinbase.ts        # Coinbase exchange parser
└── generic.ts         # Generic CSV parser
```

### How It Works
1. **File Upload** → Import API receives CSV/JSON file
2. **Format Detection** → System tests file against all parsers
3. **Best Match** → Parser with highest confidence score is selected
4. **Data Transformation** → Raw data converted to standard format
5. **Import** → Standardized transactions imported to database

---

## 🧩 Standard Transaction Format

All parsers must convert exchange data to this format:

```typescript
interface ImportTransaction {
  type: 'BUY' | 'SELL';
  btc_amount: number;
  original_price_per_btc: number;
  original_currency: string;
  original_total_amount: number;
  fees: number;
  fees_currency: string;
  transaction_date: string; // ISO date string
  notes?: string;
}
```

---

## 🔨 Creating a New Parser

### Step 1: Create Parser File

Create `src/app/api/transactions/import/parsers/[exchange-name].ts`:

```typescript
import { ImportTransaction } from '../types';

export interface ExchangeNameTransaction {
  // Define the raw format from the exchange
  date: string;q
  pair: string;
  type: string;
  amount: string;
  price: string;
  total: string;
  fee: string;
  // ... other exchange-specific fields
}

export class ExchangeNameParser {
  /**
   * Detect if CSV matches this exchange format
   * Return confidence score 0-100
   */
  static detectFormat(csvContent: string): number {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return 0;

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    // Define required headers for this exchange
    const requiredHeaders = ['date', 'pair', 'type', 'amount', 'price'];
    const optionalHeaders = ['fee', 'total', 'notes'];
    
    let score = 0;
    let requiredFound = 0;
    
    // Check for required headers
    for (const required of requiredHeaders) {
      if (headers.some(h => h.includes(required))) {
        requiredFound++;
        score += 20; // 20 points per required header
      }
    }
    
    // Must have all required headers
    if (requiredFound < requiredHeaders.length) {
      return 0;
    }
    
    // Bonus points for optional headers
    for (const optional of optionalHeaders) {
      if (headers.some(h => h.includes(optional))) {
        score += 5;
      }
    }
    
    // Bonus for exchange-specific indicators
    if (headers.some(h => h.includes('exchangename_specific_field'))) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Parse CSV content to ImportTransaction array
   */
  static parseCSV(csvContent: string): ImportTransaction[] {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const transactions: ImportTransaction[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      
      if (values.length !== headers.length) {
        console.warn(`Skipping malformed line ${i + 1}`);
        continue;
      }
      
      const row: { [key: string]: string } = {};
      headers.forEach((header, index) => {
        row[header.toLowerCase()] = values[index];
      });
      
      try {
        const transaction = this.convertToStandardFormat(row);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Error parsing line ${i + 1}:`, error);
      }
    }
    
    return transactions;
  }

  /**
   * Convert exchange-specific data to standard format
   */
  private static convertToStandardFormat(row: { [key: string]: string }): ImportTransaction | null {
    // Parse date (adjust format as needed)
    const date = new Date(row.date || row.time || row.timestamp);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    
    // Determine transaction type
    let type: 'BUY' | 'SELL';
    const typeField = (row.type || row.side || '').toLowerCase();
    if (typeField.includes('buy') || typeField.includes('market buy')) {
      type = 'BUY';
    } else if (typeField.includes('sell') || typeField.includes('market sell')) {
      type = 'SELL';
    } else {
      return null; // Skip non-BTC transactions
    }
    
    // Extract currency pair (e.g., "BTCUSD" → "USD")
    const pair = row.pair || row.symbol || '';
    let currency = 'USD'; // default
    
    if (pair.includes('BTC')) {
      currency = pair.replace('BTC', '').replace('XBT', '') || 'USD';
    }
    
    // Parse amounts
    const btcAmount = parseFloat(row.amount || row.vol || row.quantity || '0');
    const pricePerBtc = parseFloat(row.price || row.rate || '0');
    const totalAmount = parseFloat(row.total || row.cost || '0') || (btcAmount * pricePerBtc);
    const fees = parseFloat(row.fee || row.fees || '0');
    
    // Validation
    if (btcAmount <= 0 || pricePerBtc <= 0) {
      throw new Error('Invalid amount or price');
    }
    
    return {
      type,
      btc_amount: btcAmount,
      original_price_per_btc: pricePerBtc,
      original_currency: currency,
      original_total_amount: totalAmount,
      fees: fees,
      fees_currency: currency,
      transaction_date: date.toISOString(),
      notes: `Imported from ExchangeName - ${row.txid || row.id || ''}`
    };
  }

  /**
   * Parse CSV line handling quoted fields
   */
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result.map(field => field.replace(/^"|"$/g, ''));
  }
}
```

### Step 2: Register Parser

Add your parser to `src/app/api/transactions/import/parsers/index.ts`:

```typescript
import { ExchangeNameParser } from './exchangename';

// Add to the parsers array
export const parsers = [
  { name: 'kraken', parser: KrakenParser },
  { name: 'binance', parser: BinanceParser },
  { name: 'coinbase', parser: CoinbaseParser },
  { name: 'exchangename', parser: ExchangeNameParser }, // Add here
  { name: 'generic', parser: GenericParser }
];
```

### Step 3: Test Your Parser

Create test CSV file and verify:

```typescript
// Test detection
const confidence = ExchangeNameParser.detectFormat(testCSV);
console.log('Detection confidence:', confidence);

// Test parsing
const transactions = ExchangeNameParser.parseCSV(testCSV);
console.log('Parsed transactions:', transactions);
```

---

## 📝 Real-World Examples

### Example 1: Kraken Format
```csv
txid,ordertxid,pair,time,type,ordertype,price,cost,fee,vol,margin,misc,ledgers
ABC123,DEF456,XXBTZUSD,2024-01-15 10:30:00,buy,market,45000.0,4500.0,22.5,0.1,0.0,,
```

**Key Fields**:
- `pair`: "XXBTZUSD" → Extract "USD"
- `type`: "buy" → Convert to "BUY"
- `vol`: 0.1 → BTC amount
- `price`: 45000.0 → Price per BTC
- `cost`: 4500.0 → Total amount
- `fee`: 22.5 → Fee amount

### Example 2: Coinbase Pro Format
```csv
portfolio,trade id,product,side,created at,size,size unit,price,fee,total,price/fee/total unit
default,12345,BTC-USD,BUY,2024-01-15T10:30:00.000Z,0.1,BTC,45000,22.5,4522.5,USD
```

**Key Fields**:
- `product`: "BTC-USD" → Extract "USD"
- `side`: "BUY" → Direct mapping
- `size`: 0.1 → BTC amount
- `price`: 45000 → Price per BTC
- `total`: 4522.5 → Total amount
- `fee`: 22.5 → Fee amount

---

## 🔍 Parser Development Tips

### Detection Strategy
1. **Header Matching**: Look for unique header combinations
2. **Data Format**: Check date formats, number formats
3. **Exchange Signatures**: Look for exchange-specific fields
4. **Confidence Scoring**: Higher score = better match

### Common Challenges
1. **Date Formats**: Exchanges use different date formats
2. **Currency Pairs**: Various naming conventions (BTC, XBT, BTCUSD, BTC-USD)
3. **Transaction Types**: Different terms (buy/sell, market/limit)
4. **Fee Handling**: Fees may be in different currencies
5. **Decimal Precision**: Different precision levels

### Best Practices
1. **Robust Parsing**: Handle malformed data gracefully
2. **Validation**: Verify all required fields present
3. **Error Handling**: Provide clear error messages
4. **Testing**: Test with real exchange exports
5. **Documentation**: Document exchange-specific quirks

---

## 🧪 Testing Your Parser

### Test Data Preparation
```typescript
// Create comprehensive test cases
const testCases = [
  {
    name: 'Valid BUY transaction',
    csv: 'date,type,amount,price,total,fee\n2024-01-15,buy,0.1,45000,4500,22.5',
    expected: 1 // Should parse 1 transaction
  },
  {
    name: 'Invalid data',
    csv: 'date,type,amount,price\n2024-01-15,buy,invalid,45000',
    expected: 0 // Should skip invalid transaction
  },
  {
    name: 'Non-BTC transaction',
    csv: 'date,type,amount,price,pair\n2024-01-15,buy,100,1.2,ETHUSD',
    expected: 0 // Should skip non-BTC
  }
];
```

### Manual Testing
1. **Export real data** from target exchange
2. **Test detection** with your parser
3. **Verify parsing** accuracy
4. **Check edge cases** (empty fields, special characters)
5. **Validate output** format

---

## 📚 Exchange-Specific Notes

### Kraken
- Uses "XXBTZUSD" format for pairs
- Timestamps in "YYYY-MM-DD HH:MM:SS" format
- Fees always in quote currency
- Uses "vol" for volume/amount

### Binance
- Uses "BTCUSDT" format for pairs
- Timestamps in milliseconds or ISO format
- Multiple fee structures
- Separate buy/sell indicators

### Coinbase Pro
- Uses "BTC-USD" format for pairs
- ISO timestamp format
- Fees included in total
- Clear side indicators (BUY/SELL)

### Generic CSV
- Fallback for unknown formats
- Requires manual column mapping
- Flexible field detection
- Lower confidence score

---

## 🚀 Deployment

### Adding to Production
1. **Create parser file** following the template
2. **Add to parser registry** in index.ts
3. **Test thoroughly** with real data
4. **Update documentation** with supported exchanges
5. **Deploy** and monitor for issues

### Version Control
- **Branch**: Create feature branch for new parser
- **Testing**: Include test files and cases
- **Documentation**: Update README with new exchange
- **PR**: Submit for review with test results

---

## 🔧 Advanced Features

### Custom Field Mapping
```typescript
// For exchanges with non-standard fields
const fieldMapping = {
  'Transaction Date': 'date',
  'Transaction Type': 'type',
  'Coin Amount': 'btc_amount',
  'Coin Price': 'price_per_btc'
};
```

### Multi-Currency Support
```typescript
// Handle different base currencies
const supportedPairs = ['BTCUSD', 'BTCEUR', 'BTCGBP', 'BTCCAD'];
const currency = pair.replace('BTC', '').replace('XBT', '');
```

### Fee Calculation
```typescript
// Handle different fee structures
if (row.fee_currency && row.fee_currency !== currency) {
  // Convert fee to transaction currency
  const feeRate = await getExchangeRate(row.fee_currency, currency);
  fees = fees * feeRate;
}
```

---

## 📋 Parser Checklist

When creating a new parser:

### Required Features
- [ ] **Format detection** with confidence scoring
- [ ] **CSV parsing** with proper field extraction
- [ ] **Data validation** for required fields
- [ ] **Error handling** for malformed data
- [ ] **Standard format conversion**
- [ ] **Date parsing** for exchange format
- [ ] **Currency extraction** from pairs
- [ ] **Fee handling** in correct currency

### Optional Features
- [ ] **JSON support** if exchange provides JSON exports
- [ ] **Multi-timeframe** support (different export formats)
- [ ] **Advanced validation** (duplicate detection)
- [ ] **Metadata preservation** (transaction IDs, order types)

### Testing Requirements
- [ ] **Real data testing** with actual exchange exports
- [ ] **Edge case handling** (empty fields, special characters)
- [ ] **Performance testing** with large files (1000+ transactions)
- [ ] **Error scenario testing** (corrupted files, wrong format)

---

## 🎯 Common Exchange Patterns

### Date Formats
```typescript
// Common date formats by exchange
const dateFormats = {
  kraken: 'YYYY-MM-DD HH:MM:SS',
  binance: 'YYYY-MM-DD HH:MM:SS',
  coinbase: 'YYYY-MM-DDTHH:MM:SS.sssZ',
  gemini: 'MM/DD/YYYY HH:MM:SS AM/PM'
};
```

### Currency Pair Formats
```typescript
// Common pair formats
const pairFormats = {
  kraken: 'XXBTZUSD',     // XBT prefix
  binance: 'BTCUSDT',     // Tether variant
  coinbase: 'BTC-USD',    // Hyphen separator
  gemini: 'BTCUSD'        // Simple format
};
```

### Transaction Types
```typescript
// Common type indicators
const typeMapping = {
  'buy': 'BUY',
  'sell': 'SELL',
  'market buy': 'BUY',
  'market sell': 'SELL',
  'limit buy': 'BUY',
  'limit sell': 'SELL'
};
```

---

## 🔍 Debugging Guide

### Common Issues
1. **Low Confidence Score**: Check header matching logic
2. **Parse Errors**: Verify CSV structure and field mapping
3. **Date Issues**: Check date format parsing
4. **Currency Problems**: Verify pair extraction logic
5. **Amount Issues**: Check decimal parsing and validation

### Debug Tools
```typescript
// Add debug logging
console.log('Headers found:', headers);
console.log('Sample row:', row);
console.log('Parsed transaction:', transaction);

// Validate intermediate steps
console.log('Detected currency:', currency);
console.log('Parsed date:', date.toISOString());
console.log('BTC amount:', btcAmount);
```

### Testing Commands
```bash
# Test parser in isolation
npm run test:parser -- --exchange=exchangename

# Test with sample file
curl -X POST http://localhost:3000/api/transactions/import \
  -F "file=@sample_export.csv" \
  -F "detect_only=true"
```

---

## 📚 Resources

### Exchange Documentation
- **Kraken**: [Export Guide](https://support.kraken.com/hc/en-us/articles/208903477-How-to-interpret-Ledger-history-fields)
- **Binance**: [Export Guide](https://www.binance.com/en/support/faq/how-to-generate-a-trading-history-report-360030749031)
- **Coinbase**: [Export Guide](https://help.coinbase.com/en/pro/managing-my-account/funding-your-account/how-to-transfer-funds-between-your-coinbase-pro-and-coinbase-accounts)

### Development Tools
- **CSV Viewer**: For analyzing exchange exports
- **Date Parser**: For testing date format conversion
- **JSON Validator**: For JSON export formats
- **Regex Tester**: For pattern matching

---

## 🤝 Contributing

### Submission Process
1. **Fork repository** and create feature branch
2. **Develop parser** following this guide
3. **Test thoroughly** with real exchange data
4. **Document** any exchange-specific quirks
5. **Submit PR** with test files and documentation

### Code Review Criteria
- **Code Quality**: Clean, readable, well-commented
- **Error Handling**: Robust error handling and validation
- **Performance**: Efficient parsing for large files
- **Testing**: Comprehensive test coverage
- **Documentation**: Clear usage instructions

---

## 🎉 Success Examples

### Recently Added Exchanges
- ✅ **Kraken**: Full support with confidence detection
- ✅ **Binance**: Multiple format support
- ✅ **Coinbase Pro**: Advanced fee handling
- ✅ **Generic**: Fallback for unknown formats


---

**Happy parsing! 🚀 Help make Bitcoin Tracker support every exchange in the ecosystem.**
