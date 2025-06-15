// Ticker functionality
function updateTicker(data) {
    console.log('Starting ticker update with data:', data);
    
    const currentValue = document.getElementById('tickerCurrentValue');
    const weeklyChange = document.getElementById('tickerDailyChange'); // Element ID stays the same for compatibility
    const weeklyPercent = document.getElementById('tickerDailyPercent'); // Element ID stays the same for compatibility
    
    if (!currentValue || !weeklyChange || !weeklyPercent) {
        console.error('Missing ticker elements:', { currentValue, weeklyChange, weeklyPercent });
        return;
    }

    // Get main currency from the data or default to EUR
    const mainCurrency = data.mainCurrency || 'EUR';
    console.log('Using main currency:', mainCurrency);
    
    // Get current price based on main currency
    let currentPrice = 0;
    const basePriceEUR = data.priceEUR || data.price || 0;
    
    if (mainCurrency === 'EUR') {
        currentPrice = basePriceEUR;
    } else if (mainCurrency === 'USD') {
        currentPrice = data.priceUSD || (basePriceEUR && data.eurUsd ? basePriceEUR * data.eurUsd : 0);
    } else {
        // Convert from EUR to other supported currencies
        const rateKey = `eur${mainCurrency.toLowerCase()}`;
        if (basePriceEUR && data[rateKey]) {
            currentPrice = basePriceEUR * data[rateKey];
        }
    }
    
    // Convert historical prices from EUR to main currency before comparison
    let weeklyPriceInMainCurrency = currentPrice; // fallback
    let weeklyPriceDate = 'unknown date';
    
    // Get historical price (always stored in EUR) and convert to main currency
    const historicalPriceEUR = data.previousWeekPrice || data.previousDayPrice || 0;
    if (historicalPriceEUR > 0) {
        if (mainCurrency === 'EUR') {
            weeklyPriceInMainCurrency = historicalPriceEUR;
        } else if (mainCurrency === 'USD' && data.eurUsd) {
            weeklyPriceInMainCurrency = historicalPriceEUR * data.eurUsd;
        } else {
            // Convert from EUR to other supported currencies
            const rateKey = `eur${mainCurrency.toLowerCase()}`;
            if (data[rateKey]) {
                weeklyPriceInMainCurrency = historicalPriceEUR * data[rateKey];
            }
        }
        weeklyPriceDate = data.weeklyPriceDate || 'previous period';
    }
    
    console.log('Price values:', {
        mainCurrency,
        priceEUR: data.priceEUR,
        priceUSD: data.priceUSD,
        price: data.price,
        previousWeekPriceEUR: data.previousWeekPrice,
        previousDayPriceEUR: data.previousDayPrice,
        historicalPriceEUR: historicalPriceEUR,
        weeklyPriceDate: weeklyPriceDate,
        resolvedCurrentPrice: currentPrice,
        resolvedWeeklyPriceInMainCurrency: weeklyPriceInMainCurrency,
        currencyConversionRate: mainCurrency === 'USD' ? data.eurUsd : data[`eur${mainCurrency.toLowerCase()}`],
        conversionApplied: mainCurrency !== 'EUR' ? `${historicalPriceEUR} EUR * ${mainCurrency === 'USD' ? data.eurUsd : data[`eur${mainCurrency.toLowerCase()}`]} = ${weeklyPriceInMainCurrency}` : 'No conversion needed'
    });
    
    const change = currentPrice - weeklyPriceInMainCurrency;
    const percentChange = weeklyPriceInMainCurrency > 0 ? (change / weeklyPriceInMainCurrency) * 100 : 0;
    
    console.log(`Calculated weekly changes (compared to ${weeklyPriceDate}):`, {
        change,
        percentChange,
        calculation: `${currentPrice} - ${weeklyPriceInMainCurrency} = ${change}`,
        percentCalc: weeklyPriceInMainCurrency > 0 ? 
            `(${change} / ${weeklyPriceInMainCurrency}) * 100 = ${percentChange}` : 
            'Skipped due to zero weekly price'
    });
    
    // Format values with appropriate currency
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: mainCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    const formattedCurrent = formatter.format(currentPrice);
    const formattedChange = formatter.format(change);
    const formattedPercent = percentChange.toFixed(2) + '%';
    
    console.log('Formatted values:', {
        current: formattedCurrent,
        weeklyChange: formattedChange,
        weeklyPercent: formattedPercent
    });
    
    // Update display
    currentValue.textContent = formattedCurrent;
    weeklyChange.textContent = formattedChange;
    weeklyPercent.textContent = formattedPercent;
    
    // Add tooltip for weekly price date
    weeklyChange.title = `Change since ${weeklyPriceDate}`;
    weeklyPercent.title = `Change since ${weeklyPriceDate}`;
    
    // Add positive/negative classes
    const changeClass = change === 0 ? '' : (change > 0 ? 'positive' : 'negative');
    weeklyChange.className = 'ticker-value ' + changeClass;
    weeklyPercent.className = 'ticker-value ' + changeClass;
    
    console.log('Applied styles:', {
        changeClass,
        weeklyChangeClass: weeklyChange.className,
        weeklyPercentClass: weeklyPercent.className
    });
}

// Function to fetch price data from unified summary endpoint
async function fetchTickerData() {
    console.log('Starting ticker data fetch from summary endpoint...');
    try {
        console.log('Sending request to /api/summary?priceOnly=true');
        const response = await fetch('/api/summary?priceOnly=true&t=' + Date.now(), {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            console.error('API request failed:', {
                status: response.status,
                statusText: response.statusText
            });
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('Response received, parsing JSON...');
        const data = await response.json();
        console.log('Parsed ticker data from summary:', data);
        
        if (!data || (typeof data.priceEUR === 'undefined' && typeof data.price === 'undefined')) {
            console.error('Invalid price data received:', data);
            throw new Error('Invalid price data received');
        }
        
        updateTicker(data);
        console.log('Ticker update completed successfully');
    } catch (error) {
        console.error('Error fetching ticker data:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
    }
}

// Initialize ticker with unified approach
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing unified ticker...');
    
    // Initial fetch
    fetchTickerData();
    
    // Update every 5 minutes for all pages
    setInterval(fetchTickerData, 5 * 60 * 1000);
    
    console.log('Ticker initialized with 5-minute updates using /api/summary endpoint');
}); 