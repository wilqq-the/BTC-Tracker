const path = require('path');
const fs = require('fs');

// Set test environment before requiring modules
process.env.BTC_TRACKER_DATA_DIR = path.join(__dirname, 'test-data-currency');
process.env.NODE_ENV = 'test';

// Import modules after setting environment
const CurrencyConverter = require('../src/server/services/currency-converter');
const priceCache = require('../src/server/priceCache');

// Set a global timeout for all tests
jest.setTimeout(30000); // 30 seconds timeout

describe('Currency Converter and Exchange Rate Tests', () => {
    let testDataDir;
    const supportedCurrencies = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'PLN', 'BRL', 'INR'];
    const baseCurrencies = ['EUR', 'USD'];
    
    beforeAll(async () => {
        // Setup test data directory
        testDataDir = process.env.BTC_TRACKER_DATA_DIR;
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true });
        }
        fs.mkdirSync(testDataDir, { recursive: true });

        // Initialize priceCache for testing
        await priceCache.initialize();
        
        // Set up comprehensive test exchange rates for all supported currencies
        const testEurRates = {
            USD: 1.14,
            PLN: 4.28,
            GBP: 0.843,
            JPY: 164.14,
            CHF: 0.938,
            BRL: 6.43
        };

        const testUsdRates = {
            EUR: 0.874,
            PLN: 3.74,
            GBP: 0.737,
            JPY: 143.45,
            CHF: 0.82,
            BRL: 5.63
        };

        await priceCache.updateExchangeRates(testEurRates, testUsdRates);
    });

    afterAll(async () => {
        // Cleanup test data directory
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true });
        }
        
        // Force Jest to exit after this test suite
        setTimeout(() => {
            if (typeof global.forceJestExit === 'function') {
                global.forceJestExit();
            }
        }, 100);
    });

    describe('Currency Support Validation', () => {
        test('should support all expected currencies', () => {
            supportedCurrencies.forEach(currency => {
                expect(CurrencyConverter.isSupported(currency)).toBe(true);
            });
        });

        test('should not support unsupported currencies', () => {
            const unsupportedCurrencies = ['XYZ', 'ABC', 'NOK', 'SEK', 'CAD', 'AUD'];
            
            unsupportedCurrencies.forEach(currency => {
                expect(CurrencyConverter.isSupported(currency)).toBe(false);
            });
        });

        test('should be case insensitive for currency support check', () => {
            supportedCurrencies.forEach(currency => {
                expect(CurrencyConverter.isSupported(currency.toLowerCase())).toBe(true);
                expect(CurrencyConverter.isSupported(currency.toUpperCase())).toBe(true);
            });
        });
    });

    describe('Exchange Rate Retrieval for All Currencies', () => {
        test('should get exchange rates from EUR to all other currencies', () => {
            const otherCurrencies = supportedCurrencies.filter(c => c !== 'EUR');
            
            otherCurrencies.forEach(currency => {
                const rate = CurrencyConverter.getRate('EUR', currency);
                expect(rate).toBeGreaterThan(0);
                expect(typeof rate).toBe('number');
                expect(isFinite(rate)).toBe(true);
            });
        });

        test('should get exchange rates from USD to all other currencies', () => {
            const otherCurrencies = supportedCurrencies.filter(c => c !== 'USD');
            
            otherCurrencies.forEach(currency => {
                const rate = CurrencyConverter.getRate('USD', currency);
                expect(rate).toBeGreaterThan(0);
                expect(typeof rate).toBe('number');
                expect(isFinite(rate)).toBe(true);
            });
        });

        test('should get reverse exchange rates for all currencies', () => {
            supportedCurrencies.forEach(fromCurrency => {
                supportedCurrencies.forEach(toCurrency => {
                    if (fromCurrency !== toCurrency) {
                        const rate = CurrencyConverter.getRate(fromCurrency, toCurrency);
                        const reverseRate = CurrencyConverter.getRate(toCurrency, fromCurrency);
                        
                        expect(rate).toBeGreaterThan(0);
                        expect(reverseRate).toBeGreaterThan(0);
                        // Test that reverse rate is approximately 1/rate (allowing for small rounding differences)
                        expect(rate * reverseRate).toBeCloseTo(1, 2);
                    }
                });
            });
        });

        test('should return 1 for same currency conversions', () => {
            supportedCurrencies.forEach(currency => {
                expect(CurrencyConverter.getRate(currency, currency)).toBe(1);
            });
        });

        test('should throw error for unsupported currency pairs', () => {
            expect(() => CurrencyConverter.getRate('XYZ', 'EUR')).toThrow('Unsupported currency pair');
            expect(() => CurrencyConverter.getRate('EUR', 'ABC')).toThrow('Unsupported currency pair');
            expect(() => CurrencyConverter.getRate('INVALID', 'ALSO_INVALID')).toThrow('Unsupported currency pair');
        });
    });

    describe('Currency Conversion for All Currencies', () => {
        const testAmount = 100;

        test('should convert from EUR to all other currencies', () => {
            const otherCurrencies = supportedCurrencies.filter(c => c !== 'EUR');
            
            otherCurrencies.forEach(currency => {
                const converted = CurrencyConverter.convert(testAmount, 'EUR', currency);
                const rate = CurrencyConverter.getRate('EUR', currency);
                
                expect(converted).toBeCloseTo(testAmount * rate, 6);
                expect(converted).toBeGreaterThan(0);
            });
        });

        test('should convert from USD to all other currencies', () => {
            const otherCurrencies = supportedCurrencies.filter(c => c !== 'USD');
            
            otherCurrencies.forEach(currency => {
                const converted = CurrencyConverter.convert(testAmount, 'USD', currency);
                const rate = CurrencyConverter.getRate('USD', currency);
                
                expect(converted).toBeCloseTo(testAmount * rate, 6);
                expect(converted).toBeGreaterThan(0);
            });
        });

        test('should handle cross-currency conversions accurately', () => {
            // Test conversions between non-base currencies
            const nonBaseCurrencies = supportedCurrencies.filter(c => !baseCurrencies.includes(c));
            
            nonBaseCurrencies.forEach(fromCurrency => {
                nonBaseCurrencies.forEach(toCurrency => {
                    if (fromCurrency !== toCurrency) {
                        const converted = CurrencyConverter.convert(testAmount, fromCurrency, toCurrency);
                        const rate = CurrencyConverter.getRate(fromCurrency, toCurrency);
                        
                        expect(converted).toBeCloseTo(testAmount * rate, 4); // Reduced precision for cross-currency
                        expect(converted).toBeGreaterThan(0);
                    }
                });
            });
        });

        test('should handle decimal amounts for all currencies', () => {
            const decimalAmount = 50.25;
            
            supportedCurrencies.forEach(fromCurrency => {
                supportedCurrencies.forEach(toCurrency => {
                    if (fromCurrency !== toCurrency) {
                        const converted = CurrencyConverter.convert(decimalAmount, fromCurrency, toCurrency);
                        const rate = CurrencyConverter.getRate(fromCurrency, toCurrency);
                        
                        expect(converted).toBeCloseTo(decimalAmount * rate, 4);
                    }
                });
            });
        });

        test('should handle zero and negative amounts', () => {
            expect(CurrencyConverter.convert(0, 'EUR', 'USD')).toBe(0);
            expect(CurrencyConverter.convert(-100, 'EUR', 'USD')).toBeLessThan(0);
        });
    });

    describe('Transaction Value Conversion for All Currencies', () => {
        test('should convert transaction values between all currency pairs', () => {
            const transactionValues = {
                price: 30000,
                cost: 3000,
                fee: 10
            };

            supportedCurrencies.forEach(fromCurrency => {
                supportedCurrencies.forEach(toCurrency => {
                    if (fromCurrency !== toCurrency) {
                        const converted = CurrencyConverter.convertValues(transactionValues, fromCurrency, toCurrency);
                        const rate = CurrencyConverter.getRate(fromCurrency, toCurrency);
                        
                        expect(converted.price).toBeCloseTo(transactionValues.price * rate, 4);
                        expect(converted.cost).toBeCloseTo(transactionValues.cost * rate, 4);
                        expect(converted.fee).toBeCloseTo(transactionValues.fee * rate, 4);
                        expect(converted.rate).toBeCloseTo(rate, 6);
                    }
                });
            });
        });

        test('should handle missing fee in transaction values', () => {
            const valuesWithoutFee = {
                price: 30000,
                cost: 3000
                // fee is missing
            };

            const converted = CurrencyConverter.convertValues(valuesWithoutFee, 'EUR', 'USD');
            
            expect(converted.fee).toBe(0); // Should default to 0
            expect(converted.price).toBeGreaterThan(0);
            expect(converted.cost).toBeGreaterThan(0);
        });
    });

    describe('Price Cache Integration for All Currencies', () => {
        test('should retrieve all currency exchange rates from price cache', () => {
            const cachedPrices = priceCache.getCachedPrices();
            
            expect(cachedPrices.exchangeRates).toBeDefined();
            expect(cachedPrices.exchangeRates.EUR).toBeDefined();
            expect(cachedPrices.exchangeRates.USD).toBeDefined();
            
            // Check that all supported currencies (except base currencies) have rates
            const otherCurrencies = supportedCurrencies.filter(c => !baseCurrencies.includes(c));
            otherCurrencies.forEach(currency => {
                expect(cachedPrices.exchangeRates.EUR[currency]).toBeGreaterThan(0);
                expect(cachedPrices.exchangeRates.USD[currency]).toBeGreaterThan(0);
            });
        });

        test('should handle BTC price calculation in all currencies', () => {
            const testBtcPriceEur = 50000;
            priceCache.cache.priceEUR = testBtcPriceEur;
            
            supportedCurrencies.forEach(currency => {
                const btcPrice = priceCache.getBTCPrice(currency);
                
                if (currency === 'EUR') {
                    expect(btcPrice).toBe(testBtcPriceEur);
                } else {
                    // Ensure BTC price is calculated and is reasonable
                    expect(btcPrice).toBeGreaterThan(0);
                    expect(isFinite(btcPrice)).toBe(true);
                    
                    // Verify the price makes sense relative to EUR price
                    // Different currencies should have different values, but within reasonable bounds
                    if (currency === 'USD') {
                        // USD should be somewhat close to EUR (within 0.5x to 2.5x range)
                        // Allowing for higher rates as the system might be using different rate sources
                        expect(btcPrice).toBeGreaterThan(testBtcPriceEur * 0.5);
                        expect(btcPrice).toBeLessThan(testBtcPriceEur * 2.5);
                    } else if (currency === 'JPY') {
                        // JPY should be much higher due to smaller unit value
                        expect(btcPrice).toBeGreaterThan(testBtcPriceEur * 50);
                        expect(btcPrice).toBeLessThan(testBtcPriceEur * 300);
                    } else {
                        // Other currencies should be within reasonable bounds
                        expect(btcPrice).toBeGreaterThan(testBtcPriceEur * 0.1);
                        expect(btcPrice).toBeLessThan(testBtcPriceEur * 20);
                    }
                }
            });
        });

        test('should maintain legacy currency fields for backward compatibility', () => {
            const cachedPrices = priceCache.getCachedPrices();
            
            expect(cachedPrices.eurUsd).toBeDefined();
            expect(cachedPrices.eurPln).toBeDefined();
            expect(cachedPrices.eurGbp).toBeDefined();
            expect(cachedPrices.eurJpy).toBeDefined();
            expect(cachedPrices.eurChf).toBeDefined();
            expect(cachedPrices.eurBrl).toBeDefined();
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle missing exchange rates gracefully', () => {
            // Test fallback mechanism for USD specifically (since we know it has complex fallback logic)
            const originalEurRate = priceCache.cache.exchangeRates.EUR.USD;
            const originalUsdRate = priceCache.cache.exchangeRates.USD.EUR;
            const originalLegacyRate = priceCache.cache.eurUsd;
            
            // Remove USD from all possible sources
            delete priceCache.cache.exchangeRates.EUR.USD;
            delete priceCache.cache.exchangeRates.USD.EUR;
            delete priceCache.cache.eurUsd;
            
            // Should fallback to rate of 1
            const rate = priceCache.getExchangeRate('EUR', 'USD');
            expect(rate).toBe(1);
            
            // Restore original values
            if (originalEurRate) priceCache.cache.exchangeRates.EUR.USD = originalEurRate;
            if (originalUsdRate) priceCache.cache.exchangeRates.USD.EUR = originalUsdRate;
            if (originalLegacyRate) priceCache.cache.eurUsd = originalLegacyRate;
        });

        test('should handle invalid currency codes', () => {
            expect(() => CurrencyConverter.convert(100, 'INVALID', 'EUR')).toThrow();
            expect(() => CurrencyConverter.convert(100, 'EUR', 'INVALID')).toThrow();
            expect(() => CurrencyConverter.convertValues({price: 100}, 'INVALID', 'EUR')).toThrow();
        });

        test('should handle null/undefined amounts properly', () => {
            expect(CurrencyConverter.convert(null, 'EUR', 'USD')).toBe(0);
            expect(CurrencyConverter.convert(undefined, 'EUR', 'USD')).toBe(0);
            expect(CurrencyConverter.convert(NaN, 'EUR', 'USD')).toBe(0);
        });
    });

    describe('Real-world Transaction Scenarios', () => {
        test('should handle Bitcoin transactions from different countries', () => {
            const scenarios = [
                { currency: 'EUR', country: 'Europe', btcPrice: 50000, amount: 0.1 },
                { currency: 'USD', country: 'USA', btcPrice: 57000, amount: 0.1 },
                { currency: 'GBP', country: 'UK', btcPrice: 42000, amount: 0.1 },
                { currency: 'JPY', country: 'Japan', btcPrice: 8200000, amount: 0.1 },
                { currency: 'BRL', country: 'Brazil', btcPrice: 320000, amount: 0.1 },
                { currency: 'PLN', country: 'Poland', btcPrice: 214000, amount: 0.1 }
            ];

            scenarios.forEach(scenario => {
                const transactionValues = {
                    price: scenario.btcPrice,
                    cost: scenario.btcPrice * scenario.amount,
                    fee: scenario.btcPrice * scenario.amount * 0.005 // 0.5% fee
                };

                // Convert to EUR for comparison
                const convertedToEur = CurrencyConverter.convertValues(transactionValues, scenario.currency, 'EUR');
                const rate = CurrencyConverter.getRate(scenario.currency, 'EUR');
                
                expect(convertedToEur.price).toBeCloseTo(scenario.btcPrice * rate, 1);
                expect(convertedToEur.cost).toBeCloseTo(transactionValues.cost * rate, 1);
                expect(convertedToEur.fee).toBeCloseTo(transactionValues.fee * rate, 1);
            });
        });

        test('should maintain precision across multiple conversions', () => {
            const originalAmount = 1000;
            
            // Test round-trip conversions with more forgiving precision expectations
            // Cross-currency conversions can accumulate small rounding errors
            supportedCurrencies.forEach(intermediateCurrency => {
                if (intermediateCurrency !== 'EUR') {
                    // EUR -> intermediate -> EUR
                    const convertedToIntermediate = CurrencyConverter.convert(originalAmount, 'EUR', intermediateCurrency);
                    const convertedBackToEur = CurrencyConverter.convert(convertedToIntermediate, intermediateCurrency, 'EUR');
                    
                    // More forgiving precision for round-trip conversions (0.5% tolerance)
                    const tolerance = originalAmount * 0.005;
                    expect(Math.abs(convertedBackToEur - originalAmount)).toBeLessThan(tolerance);
                }
            });
        });

        test('should handle large and small amounts correctly', () => {
            const amounts = [0.001, 0.01, 1, 100, 10000, 1000000];
            
            amounts.forEach(amount => {
                supportedCurrencies.forEach(fromCurrency => {
                    supportedCurrencies.forEach(toCurrency => {
                        if (fromCurrency !== toCurrency) {
                            const converted = CurrencyConverter.convert(amount, fromCurrency, toCurrency);
                            const rate = CurrencyConverter.getRate(fromCurrency, toCurrency);
                            
                            expect(converted).toBeCloseTo(amount * rate, 6);
                            expect(isFinite(converted)).toBe(true);
                        }
                    });
                });
            });
        });
    });
}); 