/**
 * TradingView Lightweight Charts implementation for BTC Tracker
 * This file handles the desktop chart visualization using TradingView's library
 */

// Global chart instance
let tvChart = null;
let chartContainer = null;

// Helper function to get currency symbol
function getCurrencySymbol(currency) {
    const symbols = {
        'EUR': '€',
        'USD': '$',
        'GBP': '£',
        'PLN': 'zł',
        'JPY': '¥',
        'CHF': 'Fr',
        'CAD': 'C$',
        'AUD': 'A$',
        'CNY': '¥',
        'HKD': 'HK$',
        'NZD': 'NZ$',
        'SEK': 'kr',
        'KRW': '₩',
        'SGD': 'S$',
        'NOK': 'kr',
        'MXN': '$',
        'RUB': '₽',
        'ZAR': 'R',
        'BRL': 'R$',
        'INR': '₹'
    };
    return symbols[currency] || currency;
}

// Create and render the TradingView chart
function createTradingViewChart(container, data) {
    if (!data || !data.historicalBTCData || !data.historicalBTCData.length) {
        console.warn('No historical data available for TradingView chart');
        return;
    }

    // Clear any existing chart
    if (tvChart) {
        tvChart.remove();
        tvChart = null;
    }

    // Store container reference
    chartContainer = container;
    
    // Clear any existing canvas from the container
    // This is important because we might have Chart.js canvas still in there
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Get theme colors
    const isLightTheme = document.body.classList.contains('light-theme');
    const colors = {
        background: isLightTheme ? '#ffffff' : '#272727',
        text: isLightTheme ? '#333333' : '#e2e8f0',
        grid: isLightTheme ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.07)',
        border: isLightTheme ? '#ddd' : '#333',
        upColor: '#26a69a',
        downColor: '#ef5350',
        btcLine: '#f7931a',
        avgLine: '#667eea',
        buyingAvgLine: '#48bb78'
    };

    // Check if library is loaded
    if (typeof LightweightCharts !== 'object' || typeof LightweightCharts.createChart !== 'function') {
        console.error('TradingView Lightweight Charts library not loaded correctly!', LightweightCharts);
        return null;
    }
    
    // Make sure the container has enough height for the time scale
    if (container.clientHeight < 300) {
        container.style.minHeight = '300px';
    }
    
    // Create chart with professional TradingView style
    const chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        grid: {
            vertLines: { 
                color: colors.grid, 
                style: LightweightCharts.LineStyle.Dotted,
                visible: true
            },
            horzLines: { 
                color: colors.grid, 
                style: LightweightCharts.LineStyle.Dotted,
                visible: true 
            },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Magnet,
            vertLine: {
                visible: true,
                width: 1,
                color: isLightTheme ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)',
                style: LightweightCharts.LineStyle.Dashed,
                labelBackgroundColor: colors.btcLine,
            },
            horzLine: {
                visible: true,
                width: 1,
                color: isLightTheme ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)',
                style: LightweightCharts.LineStyle.Dashed,
                labelBackgroundColor: colors.btcLine,
            },
        },
        timeScale: {
            borderColor: colors.border,
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 5, // Space on the right side
            barSpacing: 12,  // More spacing for better readability
            fixLeftEdge: true,
            lockVisibleTimeRangeOnResize: true,
            borderVisible: true,
            // Make sure axis is visible with proper margins
            visible: true,
            ticksVisible: true,
            borderColor: colors.border,
            // Format the time labels on the X-axis
            tickMarkFormatter: (time) => {
                const date = new Date(time * 1000);
                const month = date.getMonth() + 1;
                const day = date.getDate();
                // Simpler date format that takes less space
                return `${month}/${day}`;
            },
            // Ensure there's enough space for date labels
            textColor: colors.text,
            fontSize: 12,
            minHeight: 35,
            margins: {
                bottom: 10,
                right: 10
            },
            drawTicks: true, // Make sure ticks are drawn
        },
        rightPriceScale: {
            borderColor: colors.border,
            scaleMargins: {
                top: 0.2,
                bottom: 0.25, // Increased bottom margin for date labels
            },
            borderVisible: true,
            autoScale: true,
        },
        // Add extra bottom margin for the entire chart
        layout: {
            background: { type: 'solid', color: colors.background },
            textColor: colors.text,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
            fontSize: 12,
        },
        handleScroll: {
            vertTouchDrag: false, // Disable vertical drag on touch devices
        },
        watermark: {
            visible: true,
            fontSize: 36,
            horzAlign: 'center',
            vertAlign: 'center',
            color: isLightTheme ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.05)',
            text: 'BTC/USD',
        },
    });

    // Configure time scale for X-axis dates
    chart.timeScale().applyOptions({
        visible: true,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time) => {
            const date = new Date(time * 1000);
            return date.getDate() + '/' + (date.getMonth() + 1);
        }
    });

    // Create main BTC price line series with professional styling
    const mainSeries = chart.addLineSeries({
        color: colors.btcLine,
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        priceLineWidth: 1,
        priceLineStyle: LightweightCharts.LineStyle.Dashed,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        // Add price line label formatting
        priceLineSource: LightweightCharts.PriceLineSource.LastBar,
        priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
        },
        // Add a nice smooth area fill below the line
        lineType: LightweightCharts.LineType.Simple,
        // Add colored area below the line
        lastPriceAnimation: LightweightCharts.LastPriceAnimationMode.Continuous,
        // Add area fill below the line for better visual appearance
        topColor: isLightTheme ? 'rgba(247, 147, 26, 0.2)' : 'rgba(247, 147, 26, 0.3)',
        bottomColor: isLightTheme ? 'rgba(247, 147, 26, 0.0)' : 'rgba(247, 147, 26, 0.0)',
        lineVisible: true,
        baseLineVisible: false,
    });

    // Prepare BTC price data
    const mainCurrency = window.currentMainCurrency || 'EUR';
    const priceData = data.historicalBTCData.map(item => {
        let price;
        if (mainCurrency === 'USD') {
            price = item.priceUSD || item.price;
        } else if (mainCurrency === 'EUR') {
            price = item.priceEUR || item.price;
        } else {
            // For other currencies, convert from EUR
            const basePriceEUR = item.priceEUR || item.price;
            const rateKey = `eur${mainCurrency.toLowerCase()}`;
            price = basePriceEUR * (data[rateKey] || 1.0);
        }
        return {
            time: new Date(item.timestamp).getTime() / 1000,
            value: price
        };
    });

    // Set main price data
    mainSeries.setData(priceData);
    
    // Calculate min, max, and average prices for price lines
    let minPrice = priceData[0].value;
    let maxPrice = priceData[0].value;
    
    for (let i = 1; i < priceData.length; i++) {
        const price = priceData[i].value;
        if (price < minPrice) minPrice = price;
        if (price > maxPrice) maxPrice = price;
    }
    
    // Create price line for maximum price only
    const maxPriceLine = {
        price: maxPrice,
        color: colors.upColor,
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'max price',
    };
    
    // Add price line to the chart
    mainSeries.createPriceLine(maxPriceLine);
    
    // Add 3-line legend to the chart
    const legend = document.createElement('div');
    legend.className = 'tv-legend';
    
    // Make sure the container is position:relative for proper legend positioning
    if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }
    
    container.appendChild(legend);

    // Function to format prices with appropriate currency symbol and 2 decimal places
    const formatPrice = (price) => {
        const symbol = getCurrencySymbol(mainCurrency);
        return `${symbol}${price.toFixed(2)}`;
    };
    
    // Function to format dates similar to TradingView example
    const formatDate = (timestamp) => {
        try {
            // Convert timestamp to date object
            const date = new Date(timestamp * 1000);
            
            // Format like "Jan 15, 2023" as in TradingView example
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[date.getMonth()];
            const day = date.getDate();
            const year = date.getFullYear();
            
            return `${month} ${day}, ${year}`;
        } catch (err) {
            console.error('Error formatting date:', err);
            return 'Invalid date';
        }
    };
    
         // Get the last data point for initial legend
     const getLastBar = (series) => {
         return priceData[priceData.length - 1];
     };
    
    // Function to update legend HTML content - simplified to match TradingView example
    const updateLegendText = (price, date) => {
        const priceFormatted = formatPrice(price);
        
        legend.innerHTML = `
            <div class="tv-legend-line tv-legend-line-title">Bitcoin</div>
            <div class="tv-legend-line tv-legend-line-price">${priceFormatted}</div>
            <div class="tv-legend-line tv-legend-line-date">${date}</div>
        `;
    };
    
    // Update legend on crosshair movement - following the TradingView example approach
    const updateLegend = param => {
        try {
            // Check if we have a valid crosshair point with time
            if (param && param.time) {
                // Find closest price data point
                let price;
                
                // If seriesData is available, use it
                if (param.seriesData && typeof param.seriesData.get === 'function') {
                    const dataPoint = param.seriesData.get(mainSeries);
                    if (dataPoint && dataPoint.value !== undefined) {
                        price = dataPoint.value;
                    }
                }
                
                // If we couldn't get the price from seriesData, find the closest point manually
                if (price === undefined) {
                    // Find the closest data point to this time
                    const targetTime = param.time;
                    let closestPoint = null;
                    let minDiff = Infinity;
                    
                    for (const point of priceData) {
                        const diff = Math.abs(point.time - targetTime);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestPoint = point;
                        }
                    }
                    
                    if (closestPoint) {
                        price = closestPoint.value;
                    }
                }
                
                // If we found a price, update the legend
                if (price !== undefined) {
                    const date = formatDate(param.time);
                    updateLegendText(price, date);
                    return;
                }
            }
            
            // If we don't have a valid point or if something went wrong, show the last value
            const lastPrice = priceData[priceData.length - 1].value;
            const lastDate = formatDate(priceData[priceData.length - 1].time);
            updateLegendText(lastPrice, lastDate);
        } catch (err) {
            console.error('Error updating legend:', err);
            // Fallback to showing the last price
            if (priceData && priceData.length > 0) {
                const lastPrice = priceData[priceData.length - 1].value;
                const lastDate = formatDate(priceData[priceData.length - 1].time);
                updateLegendText(lastPrice, lastDate);
            }
        }
    };
    
    // Subscribe to crosshair movements
    chart.subscribeCrosshairMove(updateLegend);
    
    // Manually trigger initial legend update
    updateLegend(undefined);
    
    // Make sure the chart has mouse tracking enabled
    chart.applyOptions({
        handleScroll: true,
        handleScale: true,
        trackingMode: {
            exitMode: 1  // Exit tracking mode when leaving the chart
        }
    });
    
    // Calculate and add moving average series (30-day window)
    if (priceData.length > 5) {
        const movingAverageWindow = Math.min(30, Math.max(5, Math.floor(priceData.length / 20)));
        const maData = [];
        
        for (let i = 0; i < priceData.length; i++) {
            const startIdx = Math.max(0, i - movingAverageWindow + 1);
            const windowPrices = priceData.slice(startIdx, i + 1);
            const average = windowPrices.reduce((sum, price) => sum + price.value, 0) / windowPrices.length;
            
            maData.push({
                time: priceData[i].time,
                value: average
            });
        }
        
        const maSeries = chart.addLineSeries({
            color: colors.avgLine,
            lineWidth: 1.5,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        });
        
        maSeries.setData(maData);
    }
    
    // Add average buy price line if there are buy transactions
    const hasBuyTransactions = data.transactions?.some(tx => tx.type === 'buy');
    if (hasBuyTransactions && data.transactions && data.transactions.length > 0 && data.averagePrice) {
        // Get the average buy price
        let avgPrice;
        if (typeof data.averagePrice === 'object') {
            avgPrice = data.averagePrice[mainCurrency.toLowerCase()] || 0;
        } else {
            avgPrice = data.averagePrice;
        }
        
        // Add a horizontal line for average buy price
        if (avgPrice > 0) {
            const avgLine = chart.addLineSeries({
                color: colors.buyingAvgLine,
                lineWidth: 1.5,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });
            
            // Create data for horizontal line - need two points at the extremes
            const startTime = priceData[0].time;
            const endTime = priceData[priceData.length - 1].time;
            
            avgLine.setData([
                { time: startTime, value: avgPrice },
                { time: endTime, value: avgPrice }
            ]);
        }
    }
    
    // Mark transactions on the chart
    if (data.transactions && data.transactions.length > 0) {
        const txMarkers = [];
        const txData = []; // Store transaction data for tooltips
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'tv-tx-tooltip';
        container.appendChild(tooltip);
        
        data.transactions.forEach(tx => {
            const txTime = new Date(tx.date).getTime() / 1000;
            // Skip if outside of our data range
            if (txTime < priceData[0].time || txTime > priceData[priceData.length - 1].time) {
                return;
            }
            
            // Find the price at this time by finding the closest data point
            const closestPoint = priceData.reduce((prev, curr) => 
                Math.abs(curr.time - txTime) < Math.abs(prev.time - txTime) ? curr : prev
            );
            
            // Calculate current P&L if it's a buy transaction
            const currentPrice = priceData[priceData.length - 1].value;
            const txPrice = tx.price || closestPoint.value;
            let pnl = 0;
            let pnlPercent = 0;
            
            if (tx.type === 'buy' && txPrice > 0) {
                pnl = currentPrice - txPrice;
                pnlPercent = (pnl / txPrice) * 100;
            }
            
            // Store transaction data for tooltip
            txData.push({
                id: txData.length,
                time: txTime,
                price: txPrice,
                type: tx.type,
                amount: tx.amount || 0,
                currentPrice: currentPrice,
                pnl: pnl,
                pnlPercent: pnlPercent,
                date: new Date(tx.date)
            });
            
            // Create marker with size property to make it smaller
            txMarkers.push({
                time: txTime,
                position: tx.type === 'buy' ? 'belowBar' : 'aboveBar',
                color: tx.type === 'buy' ? colors.upColor : colors.downColor,
                shape: 'circle',
                text: tx.type === 'buy' ? 'BUY' : 'SELL',
                size: 0.8, // Make markers smaller (default is 1)
                id: txData.length - 1 // Store index to txData
            });
        });
        
        // Add markers to the chart
        mainSeries.setMarkers(txMarkers);
        
        // Setup event listener for markers to show tooltip
        chart.subscribeCrosshairMove(param => {
            if (!param || !param.time || !param.point) {
                tooltip.style.display = 'none';
                return;
            }
            
            // Find if we're hovering near a transaction marker
            const hoverTime = param.time;
            const closeTx = txData.find(tx => {
                // Consider transactions within 12 hours (in seconds) to be close enough for tooltip
                return Math.abs(tx.time - hoverTime) < 43200;
            });
            
            if (!closeTx) {
                tooltip.style.display = 'none';
                return;
            }
            
            // Format values for tooltip
            const txDate = formatDate(closeTx.time);
            const txPrice = formatPrice(closeTx.price);
            const currentPrice = formatPrice(closeTx.currentPrice);
            const pnlFormatted = closeTx.pnl.toFixed(2);
            const pnlPercentFormatted = closeTx.pnlPercent.toFixed(2);
            const pnlClass = closeTx.pnl >= 0 ? 'tv-tx-tooltip-profit' : 'tv-tx-tooltip-loss';
            
            // Use a highlight color that matches the theme
            const titleColor = closeTx.type === 'buy' ? colors.upColor : colors.downColor;
            
            // Update tooltip content
            tooltip.innerHTML = `
                <div class="tv-tx-tooltip-title" style="color: ${titleColor}">${closeTx.type.toUpperCase()} Transaction</div>
                <div class="tv-tx-tooltip-row">
                    <span class="tv-tx-tooltip-label">Date:</span>
                    <span class="tv-tx-tooltip-value">${txDate}</span>
                </div>
                <div class="tv-tx-tooltip-row">
                    <span class="tv-tx-tooltip-label">Price:</span>
                    <span class="tv-tx-tooltip-value">${txPrice}</span>
                </div>
                ${closeTx.amount ? `
                <div class="tv-tx-tooltip-row">
                    <span class="tv-tx-tooltip-label">Amount:</span>
                    <span class="tv-tx-tooltip-value">${closeTx.amount} BTC</span>
                </div>` : ''}
                ${closeTx.type === 'buy' ? `
                <div class="tv-tx-tooltip-row">
                    <span class="tv-tx-tooltip-label">Current:</span>
                    <span class="tv-tx-tooltip-value">${currentPrice}</span>
                </div>
                <div class="tv-tx-tooltip-row">
                    <span class="tv-tx-tooltip-label">P&L:</span>
                    <span class="tv-tx-tooltip-value ${pnlClass}">${pnlFormatted} (${pnlPercentFormatted}%)</span>
                </div>` : ''}
            `;
            
            // Position tooltip near mouse pointer
            const x = param.point.x;
            const y = param.point.y;
            tooltip.style.left = (x + 15) + 'px';
            tooltip.style.top = (y - 20) + 'px';
            tooltip.style.display = 'block';
        });
    }
    
    // Handle time range buttons
    setupTimeRangeButtons(chart, priceData);
    
    // Store the reference
    tvChart = chart;
    
    // Setup resize handler
    setupResizeHandler(chart, container);
    
    // Setup reset zoom button
    setupResetZoomButton(chart, priceData);
    
    // Update price stats
    updatePriceStats(priceData, data);
    
    // Set default range to 3M (90 days) instead of 1M
    const now = priceData[priceData.length - 1].time;
    const msPerDay = 24 * 60 * 60;
    const threeMonthsAgo = now - (90 * msPerDay);
    
    chart.timeScale().setVisibleRange({
        from: threeMonthsAgo,
        to: now
    });
    
    return chart;
}

// Setup buttons to change time range with custom range switcher
function setupTimeRangeButtons(chart, priceData) {
    // Check current theme
    const isLightTheme = document.body.classList.contains('light-theme');
    
    // Define colors for this function scope
    const colors = {
        background: isLightTheme ? '#ffffff' : '#272727',
        text: isLightTheme ? '#333333' : '#e2e8f0',
        grid: isLightTheme ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.07)',
        border: isLightTheme ? '#ddd' : '#333',
        upColor: '#26a69a',
        downColor: '#ef5350',
        btcLine: '#f7931a',
        avgLine: '#667eea',
        buyingAvgLine: '#48bb78'
    };
    
    // Remove existing buttons if any
    const existingContainer = document.querySelector('.tv-range-switcher');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Create styles for the range switcher
    const styles = `
        .tv-range-switcher {
            display: flex;
            flex-direction: row;
            gap: 8px;
            position: absolute;
            top: 5px;
            right: 10px;
            z-index: 100;
        }
        .tv-range-switcher button {
            all: initial;
            font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif;
            font-size: 12px;
            font-style: normal;
            font-weight: 500;
            line-height: 18px;
            padding: 4px 12px;
            color: rgba(19, 23, 34, 0.8);
            background-color: rgba(240, 243, 250, 0.7);
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        .tv-range-switcher button:hover {
            background-color: rgba(224, 227, 235, 0.9);
        }
        .tv-range-switcher button.active {
            background-color: var(--accent-color);
            color: white;
        }
        
        /* Transaction tooltip styles */
        .tv-tx-tooltip {
            position: absolute;
            display: none;
            background-color: ${isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(38, 43, 77, 0.95)'};
            color: ${isLightTheme ? '#333' : '#fff'};
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            line-height: 1.5;
            z-index: 1000;
            pointer-events: none;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.26);
            border: 1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
            max-width: 300px;
        }
        .tv-tx-tooltip-title {
            font-weight: bold;
            margin-bottom: 4px;
            border-bottom: 1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
            padding-bottom: 4px;
        }
        .tv-tx-tooltip-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
        }
        .tv-tx-tooltip-label {
            margin-right: 12px;
            opacity: 0.7;
        }
        .tv-tx-tooltip-value {
            font-weight: 500;
        }
        .tv-tx-tooltip-profit {
            color: ${colors.upColor};
        }
        .tv-tx-tooltip-loss {
            color: ${colors.downColor};
        }
    `;
    
    // Add styles to document
    const stylesElement = document.createElement('style');
    stylesElement.innerHTML = styles;
    document.head.appendChild(stylesElement);
    
    // Create container for buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('tv-range-switcher');
    
    // Define intervals and their labels
    const intervals = [
        { label: '1D', days: 1 },
        { label: '1W', days: 7 },
        { label: '1M', days: 30 },
        { label: '3M', days: 90 },
        { label: '6M', days: 180 },
        { label: '1Y', days: 365 },
        { label: 'ALL', days: 0 }
    ];
    
    // Create buttons for each interval
    intervals.forEach(interval => {
        const button = document.createElement('button');
        button.innerText = interval.label;
        button.setAttribute('data-range', interval.days);
        button.addEventListener('click', function() {
            // Update active button state
            document.querySelectorAll('.tv-range-switcher button').forEach(b => 
                b.classList.toggle('active', b === this));
            
            const days = interval.days;
            
            // Calculate visible range
            const now = priceData[priceData.length - 1].time;
            
            if (days === 0) { // ALL
                chart.timeScale().fitContent();
            } else {
                const msPerDay = 24 * 60 * 60;
                const start = now - (days * msPerDay);
                
                chart.timeScale().setVisibleRange({
                    from: start,
                    to: now
                });
            }
            
            // Update price stats for the new range
            updatePriceStatsForRange(priceData, days);
            
            // Hide reset zoom button since this is an explicit range selection
            const resetZoomBtn = document.getElementById('resetZoom');
            if (resetZoomBtn) {
                resetZoomBtn.style.display = 'none';
            }
            
            // We don't need to update old buttons anymore since they were removed
            // But keeping the code commented for reference
            /*
            const oldBtn = document.querySelector(`.time-range-btn[data-range="${days}"]`);
            if (oldBtn) {
                oldBtn.click();
            }
            */
        });
        
        // Set active class on the default range (90 days / 3M)
        if (interval.days === 90) {
            button.classList.add('active');
        }
        
        buttonsContainer.appendChild(button);
    });
    
    // Add buttons to chart container
    const chartContainer = document.querySelector('.chart-wrapper');
    if (chartContainer) {
        chartContainer.style.position = 'relative';
        chartContainer.appendChild(buttonsContainer);
    }
    
    // Keep the old button functionality for compatibility
    // Note: The old time-range-btn elements may not exist anymore
    const oldButtons = document.querySelectorAll('.time-range-btn');
    if (oldButtons.length > 0) {
        oldButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const days = parseInt(this.getAttribute('data-range')) || 0;
                
                // Update active button state in UI
                document.querySelectorAll('.time-range-btn').forEach(b => 
                    b.classList.toggle('active', b === this));
                
                // Also update the TradingView range switcher
                const tvBtn = document.querySelector(`.tv-range-switcher button[data-range="${days}"]`);
                if (tvBtn) {
                    tvBtn.click();
                }
            });
        });
    }
    
    // Ensure default range is properly set by triggering the 3M button
    if (buttonsContainer.querySelector('button[data-range="90"]')) {
        // No need to trigger click since we now set the range directly in createTradingViewChart
        // Just make sure the 3M button is visually active
        buttonsContainer.querySelector('button[data-range="90"]').classList.add('active');
    }
}

// Update price stats (min/max/range) for the data
function updatePriceStats(priceData, fullData) {
    // Try to get time range from TradingView buttons first (since old buttons may be gone)
    const tvBtn = document.querySelector('.tv-range-switcher button.active');
    if (tvBtn) {
        const days = parseInt(tvBtn.getAttribute('data-range')) || 0;
        updatePriceStatsForRange(priceData, days);
        return;
    }
    
    // Fallback to old buttons if they still exist
    const activeBtn = document.querySelector('.time-range-btn.active');
    const days = parseInt(activeBtn?.getAttribute('data-range')) || 30; // Default to 1 month
    
    updatePriceStatsForRange(priceData, days);
}

// Update price stats for a specific time range
function updatePriceStatsForRange(priceData, days) {
    if (!priceData || !priceData.length) return;
    
    // Get filtered data for the selected time range
    let filteredData = priceData;
    if (days > 0) {
        const now = priceData[priceData.length - 1].time;
        const msPerDay = 24 * 60 * 60;
        const cutoff = now - (days * msPerDay);
        
        filteredData = priceData.filter(item => item.time >= cutoff);
    }
    
    // Calculate min/max values
    const prices = filteredData.map(d => d.value);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;
    const rangePercent = minPrice > 0 ? ((range / minPrice) * 100).toFixed(1) : '0.0';
    
    // Update time range label
    let timeRangeLabel = '';
    if (days === 7) {
        timeRangeLabel = '1W';
    } else if (days === 30) {
        timeRangeLabel = '1M';
    } else if (days === 90) {
        timeRangeLabel = '3M';
    } else if (days === 180) {
        timeRangeLabel = '6M';
    } else if (days === 365) {
        timeRangeLabel = '1Y';
    } else if (days === 0) {
        timeRangeLabel = 'ALL';
    } else {
        timeRangeLabel = `${days}D`;
    }
    
    // Get currency symbol
    const mainCurrency = window.currentMainCurrency || 'EUR';
    const symbol = getCurrencySymbol(mainCurrency);
    
    // Update desktop labels
    document.getElementById('desktopHighLabel').textContent = `${timeRangeLabel} High`;
    document.getElementById('desktopLowLabel').textContent = `${timeRangeLabel} Low`;
    document.getElementById('desktopRangeLabel').textContent = `${timeRangeLabel} Range`;
    document.getElementById('desktopHighPrice').textContent = `${maxPrice.toFixed(2)} ${symbol}`;
    document.getElementById('desktopLowPrice').textContent = `${minPrice.toFixed(2)} ${symbol}`;
    document.getElementById('desktopPriceRange').textContent = `${rangePercent}%`;
    
    // Update desktop range progress bar
    const desktopProgressBar = document.getElementById('desktopPriceRangeProgress');
    if (desktopProgressBar) {
        // Remove existing classes
        desktopProgressBar.classList.remove('positive', 'negative');
        
        const rangePercentNum = parseFloat(rangePercent);
        
        // Set width based on range percentage (cap at 100%)
        const fillWidth = Math.min(Math.abs(rangePercentNum), 100);
        desktopProgressBar.style.width = `${fillWidth}%`;
        
        // Set color based on whether range is positive or negative
        if (rangePercentNum > 0) {
            desktopProgressBar.classList.add('positive');
        } else {
            desktopProgressBar.classList.add('negative');
        }
    }
}

// Setup resize handler to properly size chart
function setupResizeHandler(chart, container) {
    const resizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== container) {
            return;
        }
        
        const newRect = entries[0].contentRect;
        chart.applyOptions({ 
            width: newRect.width, 
            height: newRect.height 
        });
    });
    
    resizeObserver.observe(container);
    
    // Store the observer for cleanup
    container._chartResizeObserver = resizeObserver;
}

// Setup reset zoom button
function setupResetZoomButton(chart, priceData) {
    const resetZoomBtn = document.getElementById('resetZoom');
    if (!resetZoomBtn) return;
    
    resetZoomBtn.style.display = 'none';
    
    // Reset zoom on button click
    resetZoomBtn.addEventListener('click', function() {
        chart.timeScale().fitContent();
        this.style.display = 'none';
        
        // Update stats for the selected time range
        // Try TV buttons first, then fall back to old buttons
        let days = 30; // Default to 1 month
        
        const tvBtn = document.querySelector('.tv-range-switcher button.active');
        if (tvBtn) {
            days = parseInt(tvBtn.getAttribute('data-range')) || days;
        } else {
            const activeBtn = document.querySelector('.time-range-btn.active');
            if (activeBtn) {
                days = parseInt(activeBtn.getAttribute('data-range')) || days;
            }
        }
        
        updatePriceStatsForRange(priceData, days);
    });
    
    // Show reset button when user zooms
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
        if (resetZoomBtn) {
            resetZoomBtn.style.display = 'inline-flex';
        }
    });
}

// Update chart with latest price data
function updateTradingViewChartPrice(latestPrice) {
    if (!tvChart) return;
    
    // Get the main series - in v3.8 we need to get the specific series
    const mainSeries = tvChart.getSeries();
    if (!mainSeries) return;
    
    // Get the current data
    const data = mainSeries.data();
    if (!data || !data.length) return;
    
    // Get the last data point
    const lastPoint = data[data.length - 1];
    const time = Math.floor(Date.now() / 1000);
    
    // Add new point if time has changed, otherwise update last point
    if (time > lastPoint.time) {
        mainSeries.update({
            time: time,
            value: latestPrice
        });
    } else {
        mainSeries.update({
            time: lastPoint.time,
            value: latestPrice
        });
    }
}

// For loading more data when needed (e.g., on scroll to earlier dates)
function loadMoreData(startDate, callback) {
    // This would be implemented to load more historical data when zooming out
    // Currently not needed as we load all data upfront
}

// Cleanup function to properly dispose of chart
function cleanupTradingViewChart() {
    if (tvChart) {
        tvChart.remove();
        tvChart = null;
    }
    
    if (chartContainer && chartContainer._chartResizeObserver) {
        chartContainer._chartResizeObserver.disconnect();
        chartContainer._chartResizeObserver = null;
    }
    
    // Also remove range switcher if it exists
    const rangeSwitcher = document.querySelector('.tv-range-switcher');
    if (rangeSwitcher) {
        rangeSwitcher.remove();
    }
}

// Export functions for use in main script
window.createTradingViewChart = createTradingViewChart;
window.updateTradingViewChartPrice = updateTradingViewChartPrice;
window.cleanupTradingViewChart = cleanupTradingViewChart; 