'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  LineData, 
  CandlestickData, 
  ColorType,
  LineSeries,
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers
} from 'lightweight-charts';
import { ThemedCard, ThemedText, ThemedButton, useTheme } from './ui/ThemeProvider';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';

interface BitcoinChartProps {
  height?: number;
  showVolume?: boolean;
  showTransactions?: boolean;
}

interface ChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface TransactionData {
  id: number;
  type: 'BUY' | 'SELL';
  btc_amount: number;
  original_price_per_btc: number;
  original_currency: string;
  transaction_date: string;
  notes?: string;
  converted_price_per_btc?: number; // Pre-converted price in main currency
}

interface TransactionGroup {
  id: number;
  time: number;
  transactions: TransactionData[];
  buyCount: number;
  sellCount: number;
  totalAmount: number;
  totalValue: number;
  avgPrice: number;
  primaryType: 'BUY' | 'SELL';
  isMixed: boolean;
  // currentPrice removed - use from state instead
}

type ChartType = 'candlestick' | 'line' | 'area';
type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

// Global cache to prevent repeated API calls across component instances
let globalChartDataCache: ChartData[] = [];
let globalCacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Global exchange rate cache to prevent repeated API calls
let globalExchangeRateCache: Map<string, { rate: number; timestamp: number }> = new Map();
const EXCHANGE_RATE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

export default function BitcoinChart({ height = 400, showVolume = true, showTransactions = false }: BitcoinChartProps) {
  const { theme: currentTheme } = useTheme();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  // Responsive height based on screen size
  const [chartHeight, setChartHeight] = useState(height);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [loading, setLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false); // Prevent duplicate API calls
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [timeRange, setTimeRange] = useState<TimeRange>('6M');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [allChartData, setAllChartData] = useState<ChartData[]>([]); // Store all data
  const [currentPrice, setCurrentPrice] = useState<number>(0); // Initialize with 0, will be loaded
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [priceChangePercent24h, setPriceChangePercent24h] = useState<number>(0);
  const [showMovingAverage, setShowMovingAverage] = useState<boolean>(true);
  const maSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [chartStats, setChartStats] = useState<{
    high: number;
    low: number;
    range: number;
  } | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [transactionGroups, setTransactionGroups] = useState<TransactionGroup[]>([]);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [mainCurrency, setMainCurrency] = useState<string>('USD');
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  // Handle responsive height
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) { // Mobile
        setChartHeight(300);
      } else if (width < 1024) { // Tablet
        setChartHeight(350);
      } else { // Desktop
        setChartHeight(height);
      }
    };

    handleResize(); // Set initial height
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [height]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      // Define theme colors based on current theme
      const isDark = currentTheme === 'dark';
      const colors = {
        background: isDark ? '#111827' : '#ffffff',
        textColor: isDark ? '#d1d5db' : '#374151',
        gridColor: isDark ? '#374151' : '#e5e7eb',
        borderColor: isDark ? '#4b5563' : '#d1d5db',
      };
      
      // Create chart with current theme
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartHeight,
        layout: {
          background: { type: ColorType.Solid, color: colors.background },
          textColor: colors.textColor,
        },
        grid: {
          vertLines: { color: colors.gridColor },
          horzLines: { color: colors.gridColor },
        },
        crosshair: {
          mode: 1,
        },
        rightPriceScale: {
          borderColor: colors.borderColor,
          textColor: colors.textColor,
        },
        timeScale: {
          borderColor: colors.borderColor,
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartRef.current = chart;

      // Setup crosshair move handler for transaction tooltips
      if (showTransactions) {
        setupTransactionTooltips(chart);
      }

      // Wait a tick before creating series to ensure chart is fully initialized
      setTimeout(() => {
        updateChartSeries();
      }, 0);

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && chart) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chart) {
          chart.remove();
        }
      };
    } catch (error) {
      console.error('Error initializing chart:', error);
    }
  }, [height, currentTheme]);

  // Update chart series when chart type changes
  useEffect(() => {
    updateChartSeries();
  }, [chartType]);

  // Update chart series when moving average toggle changes
  useEffect(() => {
    updateChartSeries();
  }, [showMovingAverage]);

  // Calculate statistics when chart data or time range changes
  useEffect(() => {
    calculateChartStatistics(chartData, timeRange);
  }, [chartData, timeRange]);

  // Load data when time range changes
  useEffect(() => {
    if (isLoadingData) return; // Prevent duplicate calls
    
    if (timeRange === '1D') {
      // 1D always needs fresh intraday data
      loadChartData();
    } else {
      // For other ranges, check if we have historical data
      // If we're coming from 1D, allChartData will only have intraday data
      const hasHistoricalData = allChartData.length > 100; // Historical data should have many more records than 1D
      
      if (!hasHistoricalData && globalChartDataCache.length === 0) {
        // No historical data available, need to load
        console.log('[INFO] No historical data available, loading...');
        loadChartData();
      } else if (!hasHistoricalData && globalChartDataCache.length > 0) {
        // We have cached historical data, restore it
        console.log('[INFO] Restoring cached historical data...');
        setAllChartData(globalChartDataCache);
        setChartData(globalChartDataCache);
        setCurrentPrice(globalChartDataCache[globalChartDataCache.length - 1]?.close || 106000);
        setLoading(false);
      } else if (!hasHistoricalData && allChartData.length < 100) {
        // We're coming from 1D but don't have cached data, need to load fresh
        console.log('[INFO] Coming from 1D without cached data, loading fresh historical data...');
        loadChartData();
      } else {
        // Historical data available, but we might need to update chartData if coming from 1D
        console.log('[INFO] Historical data already available, checking if chartData needs update...');
        if (chartData.length < 100 && allChartData.length > 100) {
          console.log('[INFO] Updating chartData to use historical data...');
          setChartData(allChartData);
          setCurrentPrice(allChartData[allChartData.length - 1]?.close || 106000);
        }
      }
    }
  }, [timeRange]);

  // Update viewport when time range changes (separate from data loading)
  useEffect(() => {
    if (chartRef.current && allChartData.length > 0) {
      console.log(`[INFO] Time range changed to ${timeRange}, updating viewport...`);
      setTimeout(() => {
        setViewportToTimeRange();
      }, 100);
    }
  }, [timeRange, allChartData.length]);

  // Load main currency from settings
  useEffect(() => {
    loadMainCurrency();
  }, []);

  // Load transactions when showTransactions is enabled
  useEffect(() => {
    if (showTransactions) {
      loadTransactions();
    }
  }, [showTransactions]);

  // Update transaction markers when chart data or transaction groups change
  useEffect(() => {
    if (showTransactions && transactionGroups.length > 0 && chartData.length > 0 && chartRef.current) {
      // Small delay to ensure chart is fully rendered
      setTimeout(() => {
        addTransactionMarkers();
      }, 100);
    }
  }, [transactionGroups, chartData, showTransactions, chartType]);

  // Setup tooltips when showTransactions changes
  useEffect(() => {
    if (chartRef.current && showTransactions) {
      setupTransactionTooltips(chartRef.current);
    }
  }, [showTransactions, transactionGroups]);

  // Load initial data when component mounts and set up real-time updates
  useEffect(() => {
    if (isLoadingData) return; // Prevent duplicate calls
    
    // Load current Bitcoin price
    const loadCurrentPrice = async () => {
      try {
        const priceData = await BitcoinPriceClient.getCurrentPrice();
        setCurrentPrice(priceData.price);
        setPriceChange24h(priceData.priceChange24h || 0);
        setPriceChangePercent24h(priceData.priceChangePercent24h || 0);
      } catch (error) {
        console.error('Error loading current Bitcoin price for chart:', error);
      }
    };

    loadCurrentPrice();
    
    // Check if we have cached data that's still valid
    const now = Date.now();
    if (globalChartDataCache.length > 0 && (now - globalCacheTimestamp) < CACHE_DURATION) {
      console.log('[INFO] Using cached chart data');
      setAllChartData(globalChartDataCache);
      setChartData(globalChartDataCache);
      setCurrentPrice(globalChartDataCache[globalChartDataCache.length - 1]?.close || currentPrice);
      setLoading(false);
    } else {
      // Load fresh data
      loadChartData();
    }

    // Set up real-time data updates every 1 minute for chart data
    const chartUpdateInterval = setInterval(async () => {
      console.log('[SYNC] Refreshing chart data for real-time updates...');
      try {
        // Clear cache to force fresh data
        globalChartDataCache = [];
        globalCacheTimestamp = 0;
        await loadChartData();
      } catch (error) {
        console.error('Error in chart data refresh:', error);
      }
    }, 1 * 60 * 1000); // Every 1 minute for real-time updates

    // Set up price updates every 30 seconds
    const priceUpdateInterval = setInterval(async () => {
      try {
        const priceData = await BitcoinPriceClient.getCurrentPrice();
        setCurrentPrice(priceData.price);
        setPriceChange24h(priceData.priceChange24h || 0);
        setPriceChangePercent24h(priceData.priceChangePercent24h || 0);
      } catch (error) {
        console.error('Error updating chart price:', error);
      }
    }, 30 * 1000); // Every 30 seconds

    // Cleanup intervals
    return () => {
      clearInterval(chartUpdateInterval);
      clearInterval(priceUpdateInterval);
    };
  }, []); // Empty dependency array - only run once on mount

  // Update series data when chartData changes (but only if we have data)
  useEffect(() => {
    if (chartData.length > 0) {
      updateSeriesData();
      // Set viewport after data is loaded and series is updated
      setTimeout(() => {
        setViewportToTimeRange();
      }, 200);
    }
  }, [chartData, chartType, showMovingAverage]);

  const updateChartSeries = () => {
    if (!chartRef.current) return;

    try {
      // Remove existing series safely
      try {
        if (candlestickSeriesRef.current) {
          chartRef.current.removeSeries(candlestickSeriesRef.current);
          candlestickSeriesRef.current = null;
        }
        if (lineSeriesRef.current) {
          chartRef.current.removeSeries(lineSeriesRef.current);
          lineSeriesRef.current = null;
        }
        if (areaSeriesRef.current) {
          chartRef.current.removeSeries(areaSeriesRef.current);
          areaSeriesRef.current = null;
        }
        if (maSeriesRef.current) {
          chartRef.current.removeSeries(maSeriesRef.current);
          maSeriesRef.current = null;
        }
        if (volumeSeriesRef.current) {
          chartRef.current.removeSeries(volumeSeriesRef.current);
          volumeSeriesRef.current = null;
        }
      } catch (error) {
        console.log('Error removing series (this is normal on first load):', error);
      }

      // Create new series based on type
      switch (chartType) {
        case 'candlestick':
          candlestickSeriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
            upColor: '#22c55e', // Green for up candles
            downColor: '#ef4444', // Red for down candles
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
          });
          break;

        case 'line':
          lineSeriesRef.current = chartRef.current.addSeries(LineSeries, {
            color: '#f97316',
            lineWidth: 2,
          });
          break;

        case 'area':
          areaSeriesRef.current = chartRef.current.addSeries(AreaSeries, {
            lineColor: '#f97316',
            topColor: 'rgba(249, 115, 22, 0.4)',
            bottomColor: 'rgba(249, 115, 22, 0.0)',
          });
          break;
      }

      // Add moving average series for candlestick charts
      if (chartType === 'candlestick' && showMovingAverage) {
        maSeriesRef.current = chartRef.current.addSeries(LineSeries, {
          color: '#2962FF',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }

      // Add volume series if enabled
      if (showVolume) {
        volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, {
          color: '#6b7280',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume',
        });

        chartRef.current.priceScale('volume').applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });
      }

      // Update data for new series
      updateSeriesData();
    } catch (error) {
      console.error('Error updating chart series:', error);
    }
  };

  const updateSeriesData = () => {
    if (!chartRef.current) {
      console.log('Chart not initialized yet');
      return;
    }

    if (chartData.length === 0) {
      console.log('No chart data available');
      return;
    }

    const series = getCurrentSeries();
    if (!series) {
      console.log('No series available');
      return;
    }

    console.log(`Updating ${chartType} series with ${chartData.length} data points`);

    try {
      if (chartType === 'candlestick') {
        const candlestickData: CandlestickData[] = chartData.map(item => ({
          time: formatTimeForChart(item.time),
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        }));
        (series as ISeriesApi<'Candlestick'>).setData(candlestickData);

        // Update moving average data for candlestick charts
        if (maSeriesRef.current && showMovingAverage) {
          const maData = calculateMovingAverageData(chartData, 20);
          maSeriesRef.current.setData(maData);
        }
      } else {
        const lineData: LineData[] = chartData.map(item => ({
          time: formatTimeForChart(item.time),
          value: item.close,
        }));
        (series as ISeriesApi<'Line'> | ISeriesApi<'Area'>).setData(lineData);
      }

      // Update volume data
      if (volumeSeriesRef.current && showVolume) {
        const volumeData = chartData.map(item => ({
          time: formatTimeForChart(item.time),
          value: item.volume || 0,
          color: item.close >= item.open ? '#22c55e80' : '#ef444480',
        }));
        volumeSeriesRef.current.setData(volumeData);
      }

      // Add transaction markers if enabled
      if (showTransactions && transactionGroups.length > 0 && chartData.length > 0) {
        addTransactionMarkers();
      }
    } catch (error) {
      console.error('Error setting series data:', error);
    }
  };

  const getCurrentSeries = () => {
    switch (chartType) {
      case 'candlestick': return candlestickSeriesRef.current;
      case 'line': return lineSeriesRef.current;
      case 'area': return areaSeriesRef.current;
      default: return null;
    }
  };

  // Calculate moving average data based on the official TradingView example
  const calculateMovingAverageData = (data: ChartData[], maLength: number = 20) => {
    const maData = [];

    for (let i = 0; i < data.length; i++) {
      if (i < maLength) {
        // Provide whitespace data points until the MA can be calculated
        maData.push({ time: formatTimeForChart(data[i].time) });
      } else {
        // Calculate the moving average
        let sum = 0;
        for (let j = 0; j < maLength; j++) {
          sum += data[i - j].close;
        }
        const maValue = sum / maLength;
        maData.push({ time: formatTimeForChart(data[i].time), value: maValue });
      }
    }

    return maData;
  };

  const calculateChartStatistics = (data: ChartData[], selectedTimeRange: TimeRange) => {
    if (data.length === 0) {
      setChartStats(null);
      return;
    }

    let filteredData = data;

    // Filter data based on the selected time range
    if (selectedTimeRange !== 'ALL') {
      if (selectedTimeRange === '1D') {
        // For 1D, use the current chartData as it's already filtered to intraday data
        filteredData = data;
      } else {
        // For other ranges, filter from allChartData based on time range
        const days = getTimeRangeInDays(selectedTimeRange);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        // Use allChartData for filtering to ensure we have the complete dataset
        const dataToFilter = allChartData.length > 0 ? allChartData : data;
        filteredData = dataToFilter.filter(item => {
          const itemDate = new Date(item.time);
          return itemDate >= cutoffDate;
        });
      }
    }

    if (filteredData.length === 0) {
      setChartStats(null);
      return;
    }

    const high = Math.max(...filteredData.map(d => d.high));
    const low = Math.min(...filteredData.map(d => d.low));
    const range = ((high - low) / low) * 100;

    setChartStats({
      high,
      low,
      range
    });
  };

  const formatTimeForChart = (timeString: string): any => {
    // Always convert to Unix timestamp for consistency
    // This ensures all data uses the same time format for proper viewport handling
    const date = new Date(timeString);
    return Math.floor(date.getTime() / 1000);
  };

  const filterDataByTimeRange = () => {
    // This function is deprecated - data loading now follows the same pattern as 1D
    // All data is loaded directly into chartData, viewport is controlled by setViewportToTimeRange
    console.log('[INFO] filterDataByTimeRange called - using direct data loading pattern');
  };

  const loadChartData = async () => {
    if (isLoadingData) {
      console.log('Data loading already in progress, skipping...');
      return;
    }
    
    setLoading(true);
    setIsLoadingData(true);
    console.log(`Loading chart data for ${timeRange}...`);
    
    try {
      // For 1D, always load fresh intraday data
      if (timeRange === '1D') {
        const dataResponse = await fetch(`/api/historical-data?days=1`);
        
        if (dataResponse.ok) {
          const dataResult = await dataResponse.json();
          
          if (dataResult.success && dataResult.data.length > 0) {
            console.log(`Loaded ${dataResult.data.length} intraday data points`);
            
            const formattedData = dataResult.data.map((item: any) => ({
              time: item.date,
              open: item.open_usd,
              high: item.high_usd,
              low: item.low_usd,
              close: item.close_usd,
              volume: item.volume || 0,
            }));
            
            setChartData(formattedData);
            // DON'T overwrite allChartData for 1D - preserve historical data
            // Only set allChartData if we don't have historical data yet
            if (allChartData.length < 100) {
              setAllChartData(formattedData);
            }
                      const latestPrice = formattedData[formattedData.length - 1]?.close || currentPrice;
          setCurrentPrice(latestPrice);
          console.log(`[DATA] Chart updated with ${formattedData.length} historical data points, latest: $${latestPrice.toLocaleString()}`);
          setLoading(false);
          return;
          }
        }
        
        // No intraday data available
        console.log('[WARN] No intraday data available for 1D view');
        setLoading(false);
        return;
      }

      // Check if we have valid cached data
      const now = Date.now();
      if (globalChartDataCache.length > 0 && (now - globalCacheTimestamp) < CACHE_DURATION) {
        console.log('[INFO] Using cached chart data (in loadChartData)');
        setAllChartData(globalChartDataCache);
        setChartData(globalChartDataCache); // Direct assignment like 1D
        setCurrentPrice(globalChartDataCache[globalChartDataCache.length - 1]?.close || currentPrice);
        setLoading(false);
        return;
      }

      // For other ranges, always load ALL available historical data
      console.log('Loading all available historical data...');
      
      const dataResponse = await fetch(`/api/historical-data?all=true`); // Fetch ALL available data
      
      if (dataResponse.ok) {
        const dataResult = await dataResponse.json();
        
        if (dataResult.success && dataResult.data.length > 0) {
          console.log(`[DATA] Loaded ${dataResult.data.length} historical data points from API (all available data)`);
          
          const formattedData = dataResult.data.map((item: any) => ({
            time: item.date,
            open: item.open_usd,
            high: item.high_usd,
            low: item.low_usd,
            close: item.close_usd,
            volume: item.volume || 0,
          }));
          
          // Cache the data globally
          globalChartDataCache = formattedData;
          globalCacheTimestamp = now;
          
          // Store all data and set chart data directly (like 1D)
          setAllChartData(formattedData);
          setChartData(formattedData); // Direct assignment like 1D
          const latestPrice = formattedData[formattedData.length - 1]?.close || currentPrice;
          setCurrentPrice(latestPrice);
          console.log(`[DATA] Chart updated with latest price: $${latestPrice.toLocaleString()}`);
          setLoading(false);
          return;
        }
      }
      
      // No historical data available
      console.log('[WARN] No historical data available from API');
      setLoading(false);
      return;
    } catch (error) {
      console.error('Error loading chart data:', error);
      // Show error state instead of mock data
      console.log('[WARN] Chart data loading failed');
    } finally {
      setLoading(false);
      setIsLoadingData(false);
    }
  };



  // Set chart viewport to show the selected time range
  const setViewportToTimeRange = () => {
    if (!chartRef.current || allChartData.length === 0) {
      console.log(`[WARN] Cannot set viewport: chart=${!!chartRef.current}, allData=${allChartData.length}`);
      return;
    }
    
    try {
      if (timeRange === 'ALL') {
        // Show all data - fit content to viewport
        console.log('[PIN] Setting viewport to show all data');
        chartRef.current.timeScale().fitContent();
      } else if (timeRange === '1D') {
        // For 1D, the data is already filtered to just today's data, so fit content
        console.log('[PIN] Setting viewport for 1D data');
        chartRef.current.timeScale().fitContent();
      } else {
        // For other ranges, calculate the viewport based on the time range
        const days = getTimeRangeInDays(timeRange);
        const totalDataPoints = allChartData.length;
        
        if (totalDataPoints === 0) {
          console.log('[PIN] No data available');
          return;
        }
        
        // Calculate how many data points to show from the end
        // Assuming daily data, we want to show the last N days
        const dataPointsToShow = Math.min(days, totalDataPoints);
        const startIndex = Math.max(0, totalDataPoints - dataPointsToShow);
        
        console.log(`[PIN] Setting viewport to show ${timeRange} (${dataPointsToShow} data points from index ${startIndex})`);
        
        // Convert the time strings to Unix timestamps for TradingView
        const startTime = formatTimeForChart(allChartData[startIndex].time);
        const endTime = formatTimeForChart(allChartData[totalDataPoints - 1].time);
        
        console.log(`[PIN] Viewport range: ${startTime} to ${endTime} (Unix timestamps)`);
        
        // Set the visible range using Unix timestamps
        chartRef.current.timeScale().setVisibleRange({
          from: startTime,
          to: endTime,
        });
      }
    } catch (error) {
      console.error('[ERROR] Error setting viewport:', error);
      // Fallback to fit content
      try {
        chartRef.current?.timeScale().fitContent();
      } catch (fallbackError) {
        console.error('[ERROR] Fallback viewport setting also failed:', fallbackError);
      }
    }
  };

  const getTimeRangeInDays = (range: TimeRange): number => {
    switch (range) {
      case '1D': return 1;
      case '1W': return 7;
      case '1M': return 30;
      case '3M': return 90;
      case '6M': return 180;
      case '1Y': return 365;
      case 'ALL': return 1000;
      default: return 30;
    }
  };

  // Function to group transactions by time proximity (from old charts)
  const groupTransactionsByProximity = (transactions: TransactionData[], groupingHours = 24): TransactionGroup[] => {
    if (!transactions || transactions.length === 0) return [];
    
    // Sort transactions by date
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    
    const groups: TransactionData[][] = [];
    let currentGroup = [sorted[0]];
    const groupingMs = groupingHours * 60 * 60 * 1000; // Convert hours to milliseconds
    
    for (let i = 1; i < sorted.length; i++) {
      const prevTime = new Date(sorted[i - 1].transaction_date).getTime();
      const currTime = new Date(sorted[i].transaction_date).getTime();
      
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

         // Convert groups to TransactionGroup objects
     return groups.map((group, groupIndex) => {
       const groupTime = new Date(group[0].transaction_date).getTime() / 1000; // Unix timestamp
       const buyCount = group.filter(tx => tx.type === 'BUY').length;
       const sellCount = group.filter(tx => tx.type === 'SELL').length;
       const totalAmount = group.reduce((sum, tx) => sum + tx.btc_amount, 0);
       
       // Calculate total value and average price using converted prices
       let totalValue = 0;
       let weightedPriceSum = 0;
       let totalBtcAmount = 0;
       
       group.forEach(tx => {
         // Use converted price if available, otherwise fall back to original
         const txPrice = tx.converted_price_per_btc || tx.original_price_per_btc;
         totalValue += tx.btc_amount * txPrice;
         // Calculate weighted average price
         weightedPriceSum += txPrice * tx.btc_amount;
         totalBtcAmount += tx.btc_amount;
       });
       
       // Calculate weighted average price
       const avgPrice = totalBtcAmount > 0 ? weightedPriceSum / totalBtcAmount : 0;
       
       // Determine primary type
       const primaryType = buyCount >= sellCount ? 'BUY' : 'SELL';
       const isMixed = buyCount > 0 && sellCount > 0;
       
       return {
         id: groupIndex,
         time: groupTime,
         transactions: group,
         buyCount,
         sellCount,
         totalAmount,
         totalValue,
         avgPrice,
         primaryType,
         isMixed
         // Don't store currentPrice here - use it from state when needed
       };
     });
   };

  // Add transaction markers to the chart
  const addTransactionMarkers = () => {
    const series = getCurrentSeries();
    if (!series || !chartData.length) return;

    const isDark = currentTheme === 'dark';
    const colors = {
      profit: '#22c55e',  // Green for profit
      loss: '#ef4444',    // Red for loss
      mixedColor: '#8b5cf6'
    };

    // Filter groups that are within the chart data time range
    const chartStartTime = formatTimeForChart(chartData[0].time);
    const chartEndTime = formatTimeForChart(chartData[chartData.length - 1].time);

    const validGroups = transactionGroups.filter(group => 
      group.time >= chartStartTime && group.time <= chartEndTime
    );

    const markers = validGroups.map(group => {
      // Calculate P&L for the group
      let isProfitable = false;
      let markerColor = colors.mixedColor;
      
      if (!group.isMixed) {
        if (group.primaryType === 'BUY') {
          // For BUY: profitable if current price > average buy price
          const avgBuyPrice = group.avgPrice;
          isProfitable = currentPrice > avgBuyPrice;
          markerColor = isProfitable ? colors.profit : colors.loss;
        } else {
          // For SELL: we need to compare with the average buy price before this sell
          // For now, use a simple comparison: profitable if sold above current price
          // (meaning we sold at a good time)
          const avgSellPrice = group.avgPrice;
          isProfitable = avgSellPrice > currentPrice;
          markerColor = isProfitable ? colors.profit : colors.loss;
        }
      } else {
        // For mixed groups, calculate net P&L
        let totalPnL = 0;
        group.transactions.forEach(tx => {
          const txPrice = tx.converted_price_per_btc || tx.original_price_per_btc;
          if (tx.type === 'BUY') {
            // For buys, calculate unrealized P&L
            const pnl = (currentPrice - txPrice) * tx.btc_amount;
            totalPnL += pnl;
          } else {
            // For sells, assume profitable if sold above current price
            const pnl = (txPrice - currentPrice) * tx.btc_amount;
            totalPnL += pnl;
          }
        });
        isProfitable = totalPnL > 0;
        markerColor = colors.mixedColor; // Keep mixed color for mixed groups
      }
      
      // Calculate marker size based on total value
      let markerSize = 1;
      if (group.totalValue > 50000) {
        markerSize = 2;
      } else if (group.totalValue > 20000) {
        markerSize = 1.5;
      } else if (group.totalValue > 10000) {
        markerSize = 1.2;
      }

      // Create marker text based on group size
      let markerText = '';
      if (group.transactions.length === 1) {
        markerText = group.primaryType === 'BUY' ? 'B' : 'S';
      } else if (group.isMixed) {
        markerText = `${group.buyCount}B/${group.sellCount}S`;
      } else {
        markerText = `${group.transactions.length}${group.primaryType === 'BUY' ? 'B' : 'S'}`;
      }

      return {
        time: group.time,
        position: group.primaryType === 'BUY' ? 'belowBar' : 'aboveBar',
        color: markerColor,
        shape: group.isMixed ? 'square' : 'circle',
        text: markerText,
        size: markerSize,
        id: group.id.toString()
      } as any;
    });

    // Set markers on the series using the correct API
    try {
      createSeriesMarkers(series, markers);
      console.log(`[PIN] Added ${markers.length} transaction markers to chart`);
    } catch (error) {
      console.error('Error setting transaction markers:', error);
    }
  };

  // Load main currency from settings
  const loadMainCurrency = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setMainCurrency(result.data.currency.mainCurrency);
        } else {
          throw new Error('Failed to load settings');
        }
      } else {
        throw new Error('Settings API request failed');
      }
    } catch (error) {
      console.error('Error loading main currency:', error);
      // Fallback to USD
      setMainCurrency('USD');
    }
  };

  // Pre-load exchange rates for all unique currency pairs
  const preloadExchangeRates = async (transactions: any[]) => {
    const uniqueCurrencies = new Set<string>();
    transactions.forEach(tx => {
      if (tx.original_currency !== mainCurrency) {
        uniqueCurrencies.add(tx.original_currency);
      }
    });

    const currencyArray = Array.from(uniqueCurrencies);
    if (currencyArray.length === 0) return;

    console.log(`[SYNC] Pre-loading exchange rates for ${currencyArray.length} currencies: ${currencyArray.join(', ')}`);

    // Load all exchange rates in parallel
    const ratePromises = currencyArray.map(async (currency) => {
      const cacheKey = `${currency}-${mainCurrency}`;
      const now = Date.now();
      
      // Check if already cached and fresh
      const cached = globalExchangeRateCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < EXCHANGE_RATE_CACHE_DURATION) {
        return; // Already cached
      }

      try {
        const response = await fetch(`/api/exchange-rates?from=${currency}&to=${mainCurrency}`);
        if (response.ok) {
          const result = await response.json();
          globalExchangeRateCache.set(cacheKey, { rate: result.rate, timestamp: now });
        }
      } catch (error) {
        console.error(`Error pre-loading exchange rate for ${currency}:`, error);
      }
    });

    await Promise.all(ratePromises);
    console.log(`[OK] Exchange rates pre-loaded for ${currencyArray.length} currencies`);
  };

  // Load transactions from API and pre-convert prices
  const loadTransactions = async () => {
    if (isLoadingTransactions) {
      console.log('[SYNC] Transactions already loading, skipping...');
      return;
    }
    
    setIsLoadingTransactions(true);
    try {
      const response = await fetch('/api/transactions');
      const result = await response.json();
      
      if (result.success && result.data) {
        // First, map the basic transaction data
        const basicTransactionData: TransactionData[] = result.data.map((tx: any) => ({
          id: tx.id,
          type: tx.type,
          btc_amount: tx.btc_amount,
          original_price_per_btc: tx.original_price_per_btc,
          original_currency: tx.original_currency,
          transaction_date: tx.transaction_date,
          notes: tx.notes
        }));
        
        // Pre-load all needed exchange rates first
        await preloadExchangeRates(basicTransactionData);
        
        // Now convert all transaction prices using cached rates
        const transactionDataWithConvertedPrices: TransactionData[] = await Promise.all(
          basicTransactionData.map(async (tx) => {
            const convertedPrice = await convertToMainCurrency(tx.original_price_per_btc, tx.original_currency);
            return {
              ...tx,
              converted_price_per_btc: convertedPrice
            };
          })
        );
        
        setTransactions(transactionDataWithConvertedPrices);
        
        // Group transactions and update state
        const groups = groupTransactionsByProximity(transactionDataWithConvertedPrices, 24);
        setTransactionGroups(groups);
        
        console.log(`[DATA] Loaded ${transactionDataWithConvertedPrices.length} transactions, grouped into ${groups.length} groups`);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Helper function to convert transaction price to main currency (with global caching)
  const convertToMainCurrency = async (originalPrice: number, originalCurrency: string): Promise<number> => {
    if (originalCurrency === mainCurrency) {
      return originalPrice;
    }
    
    const cacheKey = `${originalCurrency}-${mainCurrency}`;
    const now = Date.now();
    
    // Check global cache first
    const cached = globalExchangeRateCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < EXCHANGE_RATE_CACHE_DURATION) {
      return originalPrice * cached.rate;
    }
    
    try {
      const response = await fetch(`/api/exchange-rates?from=${originalCurrency}&to=${mainCurrency}`);
      if (response.ok) {
        const result = await response.json();
        // Cache the rate globally
        globalExchangeRateCache.set(cacheKey, { rate: result.rate, timestamp: now });
        return originalPrice * result.rate;
      } else {
        throw new Error('Exchange rate API request failed');
      }
    } catch (error) {
      console.error(`Error converting ${originalCurrency} to ${mainCurrency}:`, error);
      return originalPrice; // Fallback to original price
    }
  };

  // Setup transaction tooltips with crosshair move handler
  const setupTransactionTooltips = (chart: IChartApi) => {
    chart.subscribeCrosshairMove((param) => {
      if (!tooltipRef.current || !showTransactions) return;

      if (!param || !param.time || !param.point) {
        tooltipRef.current.style.display = 'none';
        return;
      }

      // Find if we're hovering near a transaction group
      const hoverTime = param.time as number;
      const closeGroup = transactionGroups.find(group => {
        // Consider groups within 24 hours to be close enough for tooltip
        return Math.abs(group.time - hoverTime) < 86400;
      });

      if (!closeGroup) {
        tooltipRef.current.style.display = 'none';
        return;
      }

      // Build tooltip content
      const currencySymbol = mainCurrency === 'EUR' ? '€' : '$';
      const formatPrice = (price: number) => `${currencySymbol}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const formatBtc = (amount: number) => `${amount.toFixed(8)} BTC`;
      const formatDate = (timestamp: number) => new Date(timestamp * 1000).toLocaleDateString();

      let tooltipContent = '';

             if (closeGroup.transactions.length === 1) {
         // Single transaction
         const tx = closeGroup.transactions[0];
         const txDate = formatDate(closeGroup.time);
         
        // Use pre-converted price
        const convertedPrice = tx.converted_price_per_btc || tx.original_price_per_btc;
        const txPrice = formatPrice(convertedPrice);
        const currentPriceFormatted = formatPrice(currentPrice); // Use currentPrice from state
         
         // Calculate P&L based on transaction type
        let actualPnL = 0;
        let pnlPercent = 0;
        let pnlClass = '';
        
        if (closeGroup.primaryType === 'BUY') {
          // For BUY: profit if current price > buy price
          const priceDiff = currentPrice - convertedPrice;
          actualPnL = priceDiff * closeGroup.totalAmount;
          pnlPercent = convertedPrice > 0 ? (priceDiff / convertedPrice) * 100 : 0;
          pnlClass = actualPnL >= 0 ? 'text-green-500' : 'text-red-500';
        } else {
          // For SELL: show if it was a good sell (sold above current price)
          const priceDiff = convertedPrice - currentPrice;
          actualPnL = priceDiff * closeGroup.totalAmount;
          pnlPercent = currentPrice > 0 ? (priceDiff / currentPrice) * 100 : 0;
          pnlClass = actualPnL >= 0 ? 'text-green-500' : 'text-red-500';
        }

        tooltipContent = `
          <div class="font-semibold mb-2 ${closeGroup.primaryType === 'BUY' ? 'text-blue-500' : 'text-orange-500'}">
            ${closeGroup.primaryType} Transaction
          </div>
           <div class="space-y-1">
             <div class="flex justify-between">
               <span class="text-gray-500 dark:text-gray-400">Date:</span>
               <span>${txDate}</span>
             </div>
             <div class="flex justify-between">
               <span class="text-gray-500 dark:text-gray-400">Amount:</span>
               <span>${formatBtc(closeGroup.totalAmount)}</span>
             </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Price:</span>
              <span>${txPrice}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Current:</span>
              <span>${currentPriceFormatted}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">${closeGroup.primaryType === 'BUY' ? 'Unrealized P&L:' : 'Opportunity Cost:'}</span>
              <span class="${pnlClass}">
                ${actualPnL >= 0 ? '+' : ''}${formatPrice(actualPnL)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)
              </span>
            </div>
           </div>
         `;
             } else {
         // Multiple transactions grouped
         const groupDate = formatDate(closeGroup.time);
         
         // Calculate converted average price and total value using pre-converted prices
         let convertedTotalValue = 0;
         let convertedAvgPrice = 0;
         
         for (const tx of closeGroup.transactions) {
           const convertedPrice = tx.converted_price_per_btc || tx.original_price_per_btc;
           convertedTotalValue += tx.btc_amount * convertedPrice;
           convertedAvgPrice += convertedPrice;
         }
         convertedAvgPrice = convertedAvgPrice / closeGroup.transactions.length;
         
         const avgPrice = formatPrice(convertedAvgPrice);
         const totalValue = formatPrice(convertedTotalValue);

         // Calculate P&L for grouped transactions using pre-converted prices
         let totalPnL = 0;
         let totalBuyAmount = 0;
         let weightedAvgBuyPrice = 0;
         
         // Calculate weighted average buy price and total buy amount using pre-converted prices
         for (const tx of closeGroup.transactions) {
           if (tx.type === 'BUY') {
             const convertedPrice = tx.converted_price_per_btc || tx.original_price_per_btc;
             totalBuyAmount += tx.btc_amount;
             weightedAvgBuyPrice += convertedPrice * tx.btc_amount;
           }
         }
         
         if (totalBuyAmount > 0) {
           weightedAvgBuyPrice = weightedAvgBuyPrice / totalBuyAmount;
           totalPnL = (currentPrice - weightedAvgBuyPrice) * totalBuyAmount;
         }
         
         const pnlPercent = weightedAvgBuyPrice > 0 ? ((currentPrice - weightedAvgBuyPrice) / weightedAvgBuyPrice) * 100 : 0;
         const pnlClass = totalPnL >= 0 ? 'text-green-500' : 'text-red-500';

         tooltipContent = `
           <div class="font-semibold mb-2 ${closeGroup.isMixed ? 'text-purple-500' : (closeGroup.primaryType === 'BUY' ? 'text-green-500' : 'text-red-500')}">
             ${closeGroup.transactions.length} Grouped Transactions
           </div>
           <div class="space-y-1">
             <div class="flex justify-between">
               <span class="text-gray-500 dark:text-gray-400">Date:</span>
               <span>${groupDate}</span>
             </div>
             ${closeGroup.isMixed ? `
             <div class="flex justify-between">
               <span class="text-gray-500 dark:text-gray-400">Buys:</span>
               <span class="text-green-500">${closeGroup.buyCount}</span>
             </div>
             <div class="flex justify-between">
               <span class="text-gray-500 dark:text-gray-400">Sells:</span>
               <span class="text-red-500">${closeGroup.sellCount}</span>
             </div>` : ''}
             <div class="flex justify-between">
               <span class="text-gray-500 dark:text-gray-400">Total Amount:</span>
               <span>${formatBtc(closeGroup.totalAmount)}</span>
             </div>
             <div class="flex justify-between">
               <span class="text-gray-500 dark:text-gray-400">Avg Price:</span>
               <span>${avgPrice}</span>
             </div>
             <div class="flex justify-between">
               <span class="text-gray-500 dark:text-gray-400">Total Value:</span>
               <span>${totalValue}</span>
             </div>
             ${totalBuyAmount > 0 ? `
             <div class="flex justify-between">
               <span class="text-gray-500 dark:text-gray-400">P&L:</span>
               <span class="${pnlClass}">
                 ${totalPnL >= 0 ? '+' : ''}${formatPrice(totalPnL)} (${pnlPercent.toFixed(2)}%)
               </span>
             </div>` : ''}
           </div>
         `;
      }

      // Update tooltip content and position
      tooltipRef.current.innerHTML = tooltipContent;

      // Position tooltip
      const x = param.point.x;
      const y = param.point.y;
      const containerRect = chartContainerRef.current?.getBoundingClientRect();
      
      if (containerRect) {
        let tooltipX = x + 15;
        let tooltipY = y - 20;

        // Adjust position to avoid going off-screen
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        
        if (tooltipX + tooltipRect.width > containerRect.width) {
          tooltipX = x - tooltipRect.width - 15;
        }
        
        if (tooltipY + tooltipRect.height > containerRect.height) {
          tooltipY = y - tooltipRect.height - 20;
        }
        
        if (tooltipY < 0) {
          tooltipY = y + 20;
        }

        tooltipRef.current.style.left = `${tooltipX}px`;
        tooltipRef.current.style.top = `${tooltipY}px`;
        tooltipRef.current.style.display = 'block';
      }
    });
  };

  const timeRangeButtons: { label: string; value: TimeRange }[] = [
    { label: '1D', value: '1D' },
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '6M', value: '6M' },
    { label: '1Y', value: '1Y' },
    { label: 'ALL', value: 'ALL' },
  ];

  const chartTypeButtons: { label: string; value: ChartType; icon: string }[] = [
    { label: 'Candlestick', value: 'candlestick', icon: '▨' },
    { label: 'Line', value: 'line', icon: '⟋' },
    { label: 'Area', value: 'area', icon: '▲' },
  ];

  return (
    <ThemedCard padding={false} className="overflow-hidden">
      {/* Chart Header */}
      <div className="p-3 md:p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 md:mb-4">
          <div className="mb-2 sm:mb-0">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
              Bitcoin Price Chart
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-1">
              <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className={`text-xs md:text-sm ${priceChangePercent24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {priceChangePercent24h >= 0 ? '+' : ''}{priceChangePercent24h.toFixed(2)}% 
                <span className="hidden sm:inline"> ({priceChange24h >= 0 ? '+' : ''}${Math.abs(priceChange24h).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})</span>
              </div>
            </div>
          </div>
          
          {loading && (
            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          )}
        </div>

        {/* Chart Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          {/* Time Range Buttons - Scrollable on mobile */}
          <div className="flex space-x-1 overflow-x-auto pb-1 sm:pb-0">
            {timeRangeButtons.map((button) => (
              <ThemedButton
                key={button.value}
                variant={timeRange === button.value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(button.value)}
                className="flex-shrink-0 text-xs md:text-sm"
              >
                {button.label}
              </ThemedButton>
            ))}
          </div>

          {/* Chart Type Buttons */}
          <div className="flex items-center space-x-1 md:space-x-2">
            <div className="flex space-x-1">
              {chartTypeButtons.map((button) => (
                <ThemedButton
                  key={button.value}
                  variant={chartType === button.value ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setChartType(button.value)}
                  title={button.label}
                  className="text-xs md:text-sm"
                >
                  <span className="hidden sm:inline">{button.label}</span>
                  <span className="sm:hidden">{button.icon}</span>
                </ThemedButton>
              ))}
            </div>

            {/* Moving Average Toggle (only for candlestick) */}
            {chartType === 'candlestick' && (
              <ThemedButton
                variant={showMovingAverage ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setShowMovingAverage(!showMovingAverage)}
                className={`text-xs md:text-sm ${showMovingAverage ? 'bg-blue-600 text-white' : ''}`}
                title="20-period Moving Average"
              >
                MA20
              </ThemedButton>
            )}
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full" />
        
        {/* Transaction Tooltip */}
        {showTransactions && (
          <div
            ref={tooltipRef}
            className="absolute z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm pointer-events-none"
            style={{ display: 'none' }}
          >
            {/* Tooltip content will be dynamically updated */}
          </div>
        )}
        
        {loading && (
          <div className="absolute inset-0 bg-white dark:bg-gray-950 bg-opacity-50 flex items-center justify-center">
            <div className="text-gray-600 dark:text-gray-400">Loading chart...</div>
          </div>
        )}
      </div>

      {/* Chart Footer */}
      <div className="p-3 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="flex space-x-6">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Volume: </span>
              <span className="text-gray-900 dark:text-gray-100 font-mono">
                {chartData.length > 0 ? 
                  `$${(chartData[chartData.length - 1]?.volume || 0).toLocaleString()}` : 
                  'N/A'
                }
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Data Points: </span>
              <span className="text-gray-900 dark:text-gray-100 font-mono">
                {chartData.length}
              </span>
            </div>
            {chartType === 'candlestick' && showMovingAverage && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">MA20: </span>
                <span className="text-blue-400 font-mono">
                  Enabled
                </span>
              </div>
            )}
          </div>
          
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Powered by TradingView Lightweight Charts
          </div>
        </div>
      </div>

      {/* Dynamic Statistics Footer */}
      {chartStats && (
        <div className="mt-4 grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {timeRange} High
            </div>
            <div className="text-lg font-semibold text-green-500">
              ${chartStats.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {timeRange} Low
            </div>
            <div className="text-lg font-semibold text-red-500">
              ${chartStats.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {timeRange} Range
            </div>
            <div className="text-lg font-semibold text-btc-500">
              {chartStats.range.toFixed(1)}%
            </div>
          </div>
        </div>
      )}
    </ThemedCard>
  );
} 