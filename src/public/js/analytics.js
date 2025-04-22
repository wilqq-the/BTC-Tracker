// Analytics page functionality
document.addEventListener('DOMContentLoaded', function() {
  // Initialize charts when the page loads
  initializeCharts();
  
  // Set up time period selector event listeners
  setupTimePeriodSelectors();
  
  // Set the current year in footer
  document.getElementById('current-year').textContent = new Date().getFullYear();
  
  // Set up mobile navigation
  setupMobileNavigation();
  
  // Set up theme toggle
  setupThemeToggle();
  
  // Load initial analytics data
  loadAnalyticsData('all');
  
  // Set up refresh button
  if (document.getElementById('refreshAnalyticsBtn')) {
    document.getElementById('refreshAnalyticsBtn').addEventListener('click', function() {
      // Get the currently active period
      const activePeriod = document.querySelector('.time-range-btn.active').getAttribute('data-period');
      loadAnalyticsData(activePeriod);
    });
  }
});

// Setup mobile navigation dropdown
function setupMobileNavigation() {
  const currentPageBtn = document.getElementById('currentPageBtn');
  const navDropdown = document.getElementById('navDropdown');
  
  if (currentPageBtn && navDropdown) {
    currentPageBtn.addEventListener('click', function() {
      navDropdown.classList.toggle('active');
      currentPageBtn.classList.toggle('active');
    });
  }
}

// Setup theme toggle
function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const mobileThemeToggle = document.getElementById('mobileThemeToggle');
  const body = document.body;
  
  // Check if theme is stored in localStorage
  if (localStorage.getItem('theme') === 'light') {
    body.classList.add('light-theme');
  }
  
  // Setup toggle functionality
  function toggleTheme() {
    body.classList.toggle('light-theme');
    // Store theme preference
    if (body.classList.contains('light-theme')) {
      localStorage.setItem('theme', 'light');
    } else {
      localStorage.setItem('theme', 'dark');
    }
  }
  
  // Add click event listeners
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  if (mobileThemeToggle) {
    mobileThemeToggle.addEventListener('click', toggleTheme);
  }
}

// Initialize all chart canvases
function initializeCharts() {
  // Portfolio Value History Chart
  const valueHistoryCtx = document.getElementById('valueHistoryChart').getContext('2d');
  window.valueHistoryChart = new Chart(valueHistoryCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Portfolio Value',
        data: [],
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return formatCurrency(context.raw);
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: false,
          ticks: {
            callback: function(value) {
              return formatCurrency(value, true);
            }
          }
        }
      }
    }
  });
  
  // Performance Metrics Chart
  const performanceCtx = document.getElementById('performanceChart').getContext('2d');
  window.performanceChart = new Chart(performanceCtx, {
    type: 'bar',
    data: {
      labels: ['Daily', 'Weekly', 'Monthly', 'YTD', 'All Time'],
      datasets: [{
        label: 'Return %',
        data: [],
        backgroundColor: 'rgba(40, 167, 69, 0.6)',
        borderColor: 'rgba(40, 167, 69, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.raw.toFixed(2) + '%';
            }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });
}

// Set up event listeners for time period selectors
function setupTimePeriodSelectors() {
  const timeButtons = document.querySelectorAll('.time-range-btn');
  
  timeButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all buttons
      timeButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      // Load data for selected time period
      const period = this.getAttribute('data-period');
      loadAnalyticsData(period);
    });
  });
}

// Load analytics data based on selected time period
function loadAnalyticsData(period) {
  // Show loading indicators
  document.querySelectorAll('.loading-indicator').forEach(el => {
    el.style.display = 'block';
  });
  
  // Get data from localStorage or API
  const transactions = JSON.parse(localStorage.getItem('transactions')) || [];
  const priceHistory = JSON.parse(localStorage.getItem('bitcoinPriceHistory')) || {};
  
  if (transactions.length === 0 || Object.keys(priceHistory).length === 0) {
    displayNoDataMessage();
    return;
  }
  
  // Process data and update UI
  const analytics = calculateAnalytics(transactions, priceHistory, period);
  updateDashboardCards(analytics);
  updateCharts(analytics);
  
  // Hide loading indicators
  document.querySelectorAll('.loading-indicator').forEach(el => {
    el.style.display = 'none';
  });
}

// Calculate analytics from transaction and price data
function calculateAnalytics(transactions, priceHistory, period) {
  // Get date range based on selected period
  const dateRange = getDateRange(period);
  const startDate = dateRange.start;
  const endDate = dateRange.end;
  
  // Filter transactions by date
  const filteredTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate >= startDate && txDate <= endDate;
  });
  
  // Sort by date
  filteredTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate metrics
  const metrics = {
    totalInvested: 0,
    totalValue: 0,
    profitLoss: 0,
    profitLossPercent: 0,
    valueHistory: [],
    performanceByPeriod: {
      daily: 0,
      weekly: 0,
      monthly: 0,
      ytd: 0,
      allTime: 0
    }
  };
  
  // Calculate metrics based on transactions and price history
  // (This is a simplified implementation - in a real app, you would need more complex calculations)
  const currentPrice = getLatestPrice(priceHistory);
  let totalBtc = 0;
  
  // Build value history and calculate investment
  filteredTransactions.forEach(tx => {
    if (tx.type === 'buy') {
      totalBtc += parseFloat(tx.btcAmount);
      metrics.totalInvested += parseFloat(tx.fiatAmount);
    } else if (tx.type === 'sell') {
      totalBtc -= parseFloat(tx.btcAmount);
      // For sells, we subtract the fiat amount as it's coming back to us
      metrics.totalInvested -= parseFloat(tx.fiatAmount);
    }
    
    // Add to value history
    metrics.valueHistory.push({
      date: tx.date,
      value: totalBtc * getHistoricalPrice(priceHistory, tx.date)
    });
  });
  
  // Calculate current value
  metrics.totalValue = totalBtc * currentPrice;
  
  // Calculate profit/loss
  metrics.profitLoss = metrics.totalValue - metrics.totalInvested;
  metrics.profitLossPercent = metrics.totalInvested > 0 ? 
    (metrics.profitLoss / metrics.totalInvested) * 100 : 0;
  
  // Calculate performance by period
  // These would normally be more complex calculations based on historical values
  metrics.performanceByPeriod = {
    daily: getPerformance(priceHistory, 'daily'),
    weekly: getPerformance(priceHistory, 'weekly'),
    monthly: getPerformance(priceHistory, 'monthly'),
    ytd: getPerformance(priceHistory, 'ytd'),
    allTime: metrics.profitLossPercent
  };
  
  return metrics;
}

// Helper function to get date range based on period
function getDateRange(period) {
  const now = new Date();
  let start = new Date();
  
  switch(period) {
    case 'day':
      start.setDate(now.getDate() - 1);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
    case 'ytd':
      start = new Date(now.getFullYear(), 0, 1); // Jan 1st of current year
      break;
    case 'all':
    default:
      start = new Date(2009, 0, 3); // Bitcoin's inception
      break;
  }
  
  return {
    start: start,
    end: now
  };
}

// Get latest price from price history
function getLatestPrice(priceHistory) {
  const dates = Object.keys(priceHistory);
  if (dates.length === 0) return 0;
  
  // Get the most recent date
  const latestDate = dates.sort((a, b) => new Date(b) - new Date(a))[0];
  return priceHistory[latestDate];
}

// Get historical price for a specific date
function getHistoricalPrice(priceHistory, dateStr) {
  // If exact date exists, use it
  if (priceHistory[dateStr]) {
    return priceHistory[dateStr];
  }
  
  // Otherwise, find closest date
  const targetDate = new Date(dateStr);
  const dates = Object.keys(priceHistory).sort((a, b) => 
    Math.abs(new Date(a) - targetDate) - Math.abs(new Date(b) - targetDate)
  );
  
  return dates.length > 0 ? priceHistory[dates[0]] : 0;
}

// Calculate performance for different periods
function getPerformance(priceHistory, period) {
  // Simplified implementation - in a real app, this would be more complex
  const dates = Object.keys(priceHistory).sort((a, b) => new Date(a) - new Date(b));
  if (dates.length < 2) return 0;
  
  let oldIndex = 0;
  
  switch(period) {
    case 'daily':
      oldIndex = Math.max(0, dates.length - 2);
      break;
    case 'weekly':
      oldIndex = Math.max(0, dates.length - 8);
      break;
    case 'monthly':
      oldIndex = Math.max(0, dates.length - 31);
      break;
    case 'ytd':
      const currentYear = new Date().getFullYear();
      oldIndex = dates.findIndex(date => new Date(date).getFullYear() === currentYear);
      oldIndex = Math.max(0, oldIndex);
      break;
    default:
      oldIndex = 0;
  }
  
  const oldPrice = priceHistory[dates[oldIndex]];
  const newPrice = priceHistory[dates[dates.length - 1]];
  
  return oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
}

// Update dashboard cards with calculated metrics
function updateDashboardCards(analytics) {
  // Update the dashboard cards with calculated values
  document.getElementById('totalValueCard').textContent = formatCurrency(analytics.totalValue);
  document.getElementById('totalInvestedCard').textContent = formatCurrency(analytics.totalInvested);
  document.getElementById('profitLossCard').textContent = formatCurrency(analytics.profitLoss);
  
  const plPercentEl = document.getElementById('profitLossPercentCard');
  plPercentEl.textContent = analytics.profitLossPercent.toFixed(2) + '%';
  
  // Set color based on positive/negative value
  if (analytics.profitLoss >= 0) {
    document.getElementById('profitLossCard').classList.add('positive');
    document.getElementById('profitLossCard').classList.remove('negative');
    plPercentEl.classList.add('positive');
    plPercentEl.classList.remove('negative');
  } else {
    document.getElementById('profitLossCard').classList.add('negative');
    document.getElementById('profitLossCard').classList.remove('positive');
    plPercentEl.classList.add('negative');
    plPercentEl.classList.remove('positive');
  }
}

// Update charts with new data
function updateCharts(analytics) {
  // Update Portfolio Value History Chart
  if (window.valueHistoryChart) {
    const labels = analytics.valueHistory.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString();
    });
    
    const values = analytics.valueHistory.map(item => item.value);
    
    window.valueHistoryChart.data.labels = labels;
    window.valueHistoryChart.data.datasets[0].data = values;
    window.valueHistoryChart.update();
  }
  
  // Update Performance Chart
  if (window.performanceChart) {
    const performanceData = [
      analytics.performanceByPeriod.daily,
      analytics.performanceByPeriod.weekly,
      analytics.performanceByPeriod.monthly,
      analytics.performanceByPeriod.ytd,
      analytics.performanceByPeriod.allTime
    ];
    
    const backgroundColors = performanceData.map(val => 
      val >= 0 ? 'rgba(40, 167, 69, 0.6)' : 'rgba(220, 53, 69, 0.6)'
    );
    
    const borderColors = performanceData.map(val => 
      val >= 0 ? 'rgba(40, 167, 69, 1)' : 'rgba(220, 53, 69, 1)'
    );
    
    window.performanceChart.data.datasets[0].data = performanceData;
    window.performanceChart.data.datasets[0].backgroundColor = backgroundColors;
    window.performanceChart.data.datasets[0].borderColor = borderColors;
    window.performanceChart.update();
  }
}

// Display formatted currency value
function formatCurrency(value, abbreviated = false) {
  const mainCurrency = localStorage.getItem('mainCurrency') || 'USD';
  
  // Get currency symbol
  let symbol = '$';
  if (mainCurrency === 'EUR') symbol = '€';
  if (mainCurrency === 'GBP') symbol = '£';
  
  // Format the number
  let formattedValue;
  if (abbreviated && Math.abs(value) >= 1000) {
    if (Math.abs(value) >= 1000000) {
      formattedValue = (value / 1000000).toFixed(2) + 'M';
    } else {
      formattedValue = (value / 1000).toFixed(2) + 'k';
    }
  } else {
    formattedValue = value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  return symbol + formattedValue;
}

// Display no data message when necessary
function displayNoDataMessage() {
  document.querySelectorAll('.loading-indicator').forEach(el => {
    el.style.display = 'none';
  });
  
  document.querySelectorAll('.metrics-card-value').forEach(el => {
    el.textContent = 'No data';
  });
  
  // Clear charts
  if (window.valueHistoryChart) {
    window.valueHistoryChart.data.labels = [];
    window.valueHistoryChart.data.datasets[0].data = [];
    window.valueHistoryChart.update();
  }
  
  if (window.performanceChart) {
    window.performanceChart.data.datasets[0].data = [0, 0, 0, 0, 0];
    window.performanceChart.update();
  }
} 