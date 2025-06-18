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

// Function to group transactions by time proximity
function groupTransactionsByProximity(transactions, groupingHours = 24) {
    if (!transactions || transactions.length === 0) return [];
    
    // Sort transactions by date
    const sorted = [...transactions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const groups = [];
    let currentGroup = [sorted[0]];
    const groupingMs = groupingHours * 60 * 60 * 1000; // Convert hours to milliseconds
    
    for (let i = 1; i < sorted.length; i++) {
        const prevTime = new Date(sorted[i - 1].date).getTime();
        const currTime = new Date(sorted[i].date).getTime();
        
        // If transactions are within the grouping window, add to current group
        if (currTime - prevTime <= groupingMs) {
            currentGroup.push(sorted[i]);
        } else {
            // Otherwise, save current group and start a new one
            groups.push(currentGroup);
            currentGroup = [sorted[i]];
        }
    }
    
    // Don't forget the last group
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }
    
    return groups;
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
    
    // Check if series types are available (v5.0 requirement)
    if (!LightweightCharts.AreaSeries || !LightweightCharts.LineSeries) {
        console.error('TradingView Lightweight Charts series types not available!', LightweightCharts);
        return null;
    }
    
    // Log available functions for debugging
    console.log('Available LightweightCharts functions:', Object.keys(LightweightCharts));
    
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
            borderVisible: true,
            tickMarkFormatter: (time) => {
                const date = new Date(time * 1000);
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                });
            },
        },
        rightPriceScale: {
            borderColor: colors.border,
            scaleMargins: {
                top: 0.1,
                bottom: 0.1,
            },
            borderVisible: true,
            autoScale: true,
            entireTextOnly: true,
        },
        layout: {
            background: { type: 'solid', color: colors.background },
            textColor: colors.text,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
            fontSize: 11,
        },
        handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false,
        },
        handleScale: {
            mouseWheel: true,
            pinch: true,
            axisPressedMouseMove: {
                time: true,
                price: true,
            },
        },
    });

    // Add window resize handler to ensure chart stays responsive
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
    
    // Add watermark using v5.0 plugin API
    if (LightweightCharts.createTextWatermark) {
        const firstPane = chart.panes()[0];
        LightweightCharts.createTextWatermark(firstPane, {
            horzAlign: 'center',
            vertAlign: 'center',
            lines: [{
                text: 'BTC/USD',
                color: isLightTheme ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.05)',
                fontSize: 36,
            }],
        });
    }
    
    // Create main BTC price line series with professional styling using v5.0 API
    const mainSeries = chart.addSeries(LightweightCharts.AreaSeries, {
        lineColor: colors.btcLine,
        topColor: colors.btcLine + '50',
        bottomColor: colors.btcLine + '10',
        lineWidth: 2,
        priceLineVisible: true,
        crosshairMarkerVisible: true,
        priceLineWidth: 1,
        priceLineColor: colors.btcLine,
        priceLineStyle: LightweightCharts.LineStyle.Dashed,
    });

    // Store the main series reference globally for updates
    window.tvMainSeries = mainSeries;

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
        
        const maSeries = chart.addSeries(LightweightCharts.LineSeries, {
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
            const avgLine = chart.addSeries(LightweightCharts.LineSeries, {
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
    
    // Mark transactions on the chart with grouping
    if (data.transactions && data.transactions.length > 0) {
        // Group transactions that occur within 24 hours of each other
        const transactionGroups = groupTransactionsByProximity(data.transactions, 24);
        
        const txMarkers = [];
        const txGroupData = []; // Store group data for tooltips
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'tv-tx-tooltip';
        container.appendChild(tooltip);
        
        transactionGroups.forEach((group, groupIndex) => {
            // Calculate aggregate data for the group
            const groupTime = new Date(group[0].date).getTime() / 1000; // Use first transaction time
            const buyCount = group.filter(tx => tx.type === 'buy').length;
            const sellCount = group.filter(tx => tx.type === 'sell').length;
            const totalAmount = group.reduce((sum, tx) => sum + (tx.amount || 0), 0);
            
            // Skip if outside of our data range
            if (groupTime < priceData[0].time || groupTime > priceData[priceData.length - 1].time) {
                return;
            }
            
            // Find the price at this time
            const closestPoint = priceData.reduce((prev, curr) => 
                Math.abs(curr.time - groupTime) < Math.abs(prev.time - groupTime) ? curr : prev
            );
            
            // Calculate total value and average price for the group
            let totalValue = 0;
            let avgPrice = 0;
            
            group.forEach(tx => {
                const txPrice = tx.base?.[mainCurrency.toLowerCase()]?.price || tx.price || closestPoint.value;
                totalValue += (tx.amount || 0) * txPrice;
                avgPrice += txPrice;
            });
            avgPrice = avgPrice / group.length;
            
            // Determine primary type and marker properties
            const primaryType = buyCount >= sellCount ? 'buy' : 'sell';
            const isMixed = buyCount > 0 && sellCount > 0;
            
            // Calculate marker size based on total value
            let markerSize = 1;
            if (totalValue > 50000) {
                markerSize = 2;
            } else if (totalValue > 20000) {
                markerSize = 1.5;
            } else if (totalValue > 10000) {
                markerSize = 1.2;
            }
            
            // Store group data for tooltip
            txGroupData.push({
                id: groupIndex,
                time: groupTime,
                transactions: group,
                buyCount: buyCount,
                sellCount: sellCount,
                totalAmount: totalAmount,
                totalValue: totalValue,
                avgPrice: avgPrice,
                primaryType: primaryType,
                isMixed: isMixed,
                currentPrice: priceData[priceData.length - 1].value
            });
            
            // Create marker text based on group size
            let markerText = '';
            if (group.length === 1) {
                markerText = primaryType === 'buy' ? 'BUY' : 'SELL';
            } else if (isMixed) {
                markerText = `${buyCount}B/${sellCount}S`;
            } else {
                markerText = `${group.length} ${primaryType.toUpperCase()}S`;
            }
            
            // Create marker with appropriate styling
            txMarkers.push({
                time: groupTime,
                position: primaryType === 'buy' ? 'belowBar' : 'aboveBar',
                color: isMixed ? '#9b59b6' : (primaryType === 'buy' ? colors.upColor : colors.downColor),
                shape: isMixed ? 'square' : 'circle',
                text: markerText,
                size: markerSize,
                id: groupIndex // Store index to txGroupData
            });
        });
        
        // Add markers to the chart using v5.0 API
        if (LightweightCharts.createSeriesMarkers) {
            const seriesMarkers = LightweightCharts.createSeriesMarkers(mainSeries, txMarkers);
        } else {
            // Fallback for older versions or if createSeriesMarkers is not available
            console.warn('createSeriesMarkers not available, markers will not be displayed');
        }
        
        // Enhanced tooltip functionality for grouped transactions
        chart.subscribeCrosshairMove(param => {
            if (!param || !param.time || !param.point) {
                tooltip.style.display = 'none';
                return;
            }
            
            // Find if we're hovering near a transaction group
            const hoverTime = param.time;
            const closeGroup = txGroupData.find(group => {
                // Consider groups within 24 hours to be close enough for tooltip
                return Math.abs(group.time - hoverTime) < 86400;
            });
            
            if (!closeGroup) {
                tooltip.style.display = 'none';
                return;
            }
            
            // Build tooltip content for the group
            let tooltipContent = '';
            
            if (closeGroup.transactions.length === 1) {
                // Single transaction
                const tx = closeGroup.transactions[0];
                const txDate = formatDate(closeGroup.time);
                const txPrice = formatPrice(closeGroup.avgPrice);
                const currentPrice = formatPrice(closeGroup.currentPrice);
                const pnl = closeGroup.currentPrice - closeGroup.avgPrice;
                const pnlPercent = (pnl / closeGroup.avgPrice) * 100;
                const pnlClass = pnl >= 0 ? 'tv-tx-tooltip-profit' : 'tv-tx-tooltip-loss';
                
                tooltipContent = `
                    <div class="tv-tx-tooltip-title" style="color: ${closeGroup.primaryType === 'buy' ? colors.upColor : colors.downColor}">
                        ${closeGroup.primaryType.toUpperCase()} Transaction
                    </div>
                    <div class="tv-tx-tooltip-row">
                        <span class="tv-tx-tooltip-label">Date:</span>
                        <span class="tv-tx-tooltip-value">${txDate}</span>
                    </div>
                    <div class="tv-tx-tooltip-row">
                        <span class="tv-tx-tooltip-label">Amount:</span>
                        <span class="tv-tx-tooltip-value">${formatBtcDisplay ? formatBtcDisplay(closeGroup.totalAmount) : closeGroup.totalAmount.toFixed(8) + ' BTC'}</span>
                    </div>
                    <div class="tv-tx-tooltip-row">
                        <span class="tv-tx-tooltip-label">Price:</span>
                        <span class="tv-tx-tooltip-value">${txPrice}</span>
                    </div>
                    ${closeGroup.primaryType === 'buy' ? `
                    <div class="tv-tx-tooltip-row">
                        <span class="tv-tx-tooltip-label">Current:</span>
                        <span class="tv-tx-tooltip-value">${currentPrice}</span>
                    </div>
                    <div class="tv-tx-tooltip-row">
                        <span class="tv-tx-tooltip-label">P&L:</span>
                        <span class="tv-tx-tooltip-value ${pnlClass}">
                            ${getCurrencySymbol(mainCurrency)}${Math.abs(pnl).toFixed(2)} (${pnlPercent.toFixed(2)}%)
                        </span>
                    </div>` : ''}
                `;
            } else {
                // Multiple transactions grouped
                const groupDate = formatDate(closeGroup.time);
                const avgPrice = formatPrice(closeGroup.avgPrice);
                const totalValue = formatPrice(closeGroup.totalValue);
                
                // Build transaction breakdown
                let txBreakdown = '';
                if (closeGroup.isMixed) {
                    txBreakdown = `
                        <div class="tv-tx-tooltip-row">
                            <span class="tv-tx-tooltip-label">Buys:</span>
                            <span class="tv-tx-tooltip-value" style="color: ${colors.upColor}">${closeGroup.buyCount}</span>
                        </div>
                        <div class="tv-tx-tooltip-row">
                            <span class="tv-tx-tooltip-label">Sells:</span>
                            <span class="tv-tx-tooltip-value" style="color: ${colors.downColor}">${closeGroup.sellCount}</span>
                        </div>
                    `;
                }
                
                tooltipContent = `
                    <div class="tv-tx-tooltip-title" style="color: ${closeGroup.isMixed ? '#9b59b6' : (closeGroup.primaryType === 'buy' ? colors.upColor : colors.downColor)}">
                        ${closeGroup.transactions.length} Grouped Transactions
                    </div>
                    <div class="tv-tx-tooltip-row">
                        <span class="tv-tx-tooltip-label">Date:</span>
                        <span class="tv-tx-tooltip-value">${groupDate}</span>
                    </div>
                    ${txBreakdown}
                    <div class="tv-tx-tooltip-row">
                        <span class="tv-tx-tooltip-label">Total Amount:</span>
                        <span class="tv-tx-tooltip-value">${formatBtcDisplay ? formatBtcDisplay(closeGroup.totalAmount) : closeGroup.totalAmount.toFixed(8) + ' BTC'}</span>
                    </div>
                    <div class="tv-tx-tooltip-row">
                        <span class="tv-tx-tooltip-label">Avg Price:</span>
                        <span class="tv-tx-tooltip-value">${avgPrice}</span>
                    </div>
                    <div class="tv-tx-tooltip-row">
                        <span class="tv-tx-tooltip-label">Total Value:</span>
                        <span class="tv-tx-tooltip-value">${totalValue}</span>
                    </div>
                `;
                
                // Add individual transaction details in a compact format
                tooltipContent += `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'}">
                        <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px;">Individual transactions:</div>
                `;
                
                closeGroup.transactions.forEach(tx => {
                    const txAmount = tx.amount || 0;
                    const txAmountFormatted = formatBtcDisplay ? formatBtcDisplay(txAmount) : txAmount.toFixed(8) + ' BTC';
                    const txType = tx.type === 'buy' ? 'B' : 'S';
                    const txColor = tx.type === 'buy' ? colors.upColor : colors.downColor;
                    tooltipContent += `
                        <div style="font-size: 11px; margin: 2px 0;">
                            <span style="color: ${txColor}; font-weight: bold;">${txType}</span>
                            <span style="opacity: 0.8;">${txAmountFormatted}</span>
                        </div>
                    `;
                });
                
                tooltipContent += '</div>';
            }
            
            // Update tooltip
            tooltip.innerHTML = tooltipContent;
            
            // Position tooltip
            const x = param.point.x;
            const y = param.point.y;
            
            // Adjust position to avoid going off-screen
            const tooltipRect = tooltip.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            let tooltipX = x + 15;
            let tooltipY = y - 20;
            
            // Check right boundary
            if (tooltipX + tooltipRect.width > containerRect.width) {
                tooltipX = x - tooltipRect.width - 15;
            }
            
            // Check bottom boundary
            if (tooltipY + tooltipRect.height > containerRect.height) {
                tooltipY = y - tooltipRect.height - 20;
            }
            
            // Check top boundary
            if (tooltipY < 0) {
                tooltipY = y + 20;
            }
            
            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
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
            background-color: ${isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(27, 27, 27, 0.95)'};
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
            max-width: 350px !important;
            min-width: 250px;
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
        .tv-tx-tooltip-mixed {
            color: #9b59b6;
        }
        .tv-tx-tooltip-group-header {
            font-size: 10px;
            opacity: 0.7;
            margin-top: 6px;
            margin-bottom: 4px;
            padding-top: 6px;
            border-top: 1px solid ${isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
        }
        .tv-tx-tooltip-compact {
            font-size: 11px;
            line-height: 1.3;
            opacity: 0.9;
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
    
    // In v5.0, we need to store a reference to the main series
    // This function will be called after the chart is created, so we need to modify
    // the createTradingViewChart function to store the mainSeries reference
    if (!window.tvMainSeries) return;
    
    const time = Math.floor(Date.now() / 1000);
    
    // Simply update with new data point
    window.tvMainSeries.update({
        time: time,
        value: latestPrice
    });
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
    
    // Clear the main series reference
    window.tvMainSeries = null;
    
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

// Listen for BTC unit changes to refresh chart tooltips
window.addEventListener('btcUnitChanged', function(event) {
    console.log('BTC unit changed in TradingView chart, tooltips will update on next hover');
    // Note: Tooltips will automatically use the new unit on next hover since they call formatBtcDisplay dynamically
});

// Export functions for use in main script
window.createTradingViewChart = createTradingViewChart;
window.updateTradingViewChartPrice = updateTradingViewChartPrice;
window.cleanupTradingViewChart = cleanupTradingViewChart;