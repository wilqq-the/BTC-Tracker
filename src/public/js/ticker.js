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
    
    // Get current price and calculate changes based on main currency
    let currentPrice = 0;
    if (mainCurrency === 'EUR') {
        currentPrice = data.priceEUR || data.price || 0;
    } else if (mainCurrency === 'USD') {
        currentPrice = data.priceUSD || (data.priceEUR && data.eurUsd ? data.priceEUR * data.eurUsd : 0) || 0;
    } else if (data.priceEUR && data[`eur${mainCurrency.toLowerCase()}`]) {
        // Convert from EUR to other currency if rate is available
        currentPrice = data.priceEUR * data[`eur${mainCurrency.toLowerCase()}`];
    }
    
    // Use previousWeekPrice if available, otherwise fall back to previousDayPrice or current price
    const weeklyPrice = data.previousWeekPrice || data.previousDayPrice || currentPrice;
    const weeklyPriceDate = data.weeklyPriceDate || 'unknown date';
    
    console.log('Price values:', {
        mainCurrency,
        priceEUR: data.priceEUR,
        priceUSD: data.priceUSD,
        price: data.price,
        previousWeekPrice: data.previousWeekPrice,
        weeklyPriceDate: data.weeklyPriceDate,
        previousDayPrice: data.previousDayPrice,
        resolvedCurrentPrice: currentPrice,
        resolvedWeeklyPrice: weeklyPrice
    });
    
    const change = currentPrice - weeklyPrice;
    const percentChange = weeklyPrice > 0 ? (change / weeklyPrice) * 100 : 0;
    
    console.log(`Calculated weekly changes (compared to ${weeklyPriceDate}):`, {
        change,
        percentChange,
        calculation: `${currentPrice} - ${weeklyPrice} = ${change}`,
        percentCalc: weeklyPrice > 0 ? 
            `(${change} / ${weeklyPrice}) * 100 = ${percentChange}` : 
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

// Function to fetch price data
async function fetchPriceData() {
    console.log('Starting price data fetch...');
    try {
        console.log('Sending request to /api/current-price');
        const response = await fetch('/api/current-price');
        
        if (!response.ok) {
            console.error('API request failed:', {
                status: response.status,
                statusText: response.statusText
            });
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('Response received, parsing JSON...');
        const data = await response.json();
        console.log('Parsed price data:', data);
        
        if (!data || (typeof data.priceEUR === 'undefined' && typeof data.price === 'undefined')) {
            console.error('Invalid price data received:', data);
            throw new Error('Invalid price data received');
        }
        
        updateTicker(data);
        console.log('Price update completed successfully');
    } catch (error) {
        console.error('Error fetching price data:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
    }
}

// Initialize ticker
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing ticker...');
    // Initial fetch
    fetchPriceData();
    
    // Update every 5 minutes (reduced from 1 minute to avoid rate limits)
    setInterval(fetchPriceData, 5 * 60 * 1000);
}); 