/**
 * Summary Cache Service
 * 
 * This service maintains a cached version of the summary data
 * to improve API response times.
 */

const fs = require('fs');
const pathManager = require('./utils/path-manager');
const priceCache = require('./priceCache');
const Logger = require('./utils/logger');

// Initialize logger
const logger = Logger.create('SUMMARY-CACHE');

// Cache storage
let summaryCache = {
    data: null,
    lastUpdated: null,
    isUpdating: false,
    transactionCount: 0, // Track how many transactions were used to calculate this summary
    transactionTimestamp: null // Track when transactions were last modified
};

/**
 * Initialize the summary cache
 */
function initializeCache() {
    const cachePath = pathManager.getSummaryCachePath();
    
    if (fs.existsSync(cachePath)) {
        try {
            const data = fs.readFileSync(cachePath, 'utf8');
            summaryCache = JSON.parse(data);
            logger.debug(`[summaryCache] Loaded summary cache from ${cachePath}`);
        } catch (error) {
            logger.error('[summaryCache] Error loading summary cache:', error);
            summaryCache = { 
                data: null, 
                lastUpdated: null, 
                isUpdating: false,
                transactionCount: 0,
                transactionTimestamp: null
            };
        }
    } else {
        logger.debug('[summaryCache] No existing summary cache found');
        saveCache({ 
            data: null, 
            lastUpdated: null,
            transactionCount: 0,
            transactionTimestamp: null 
        });
    }
}

/**
 * Save cache to disk
 */
function saveCache(cache) {
    const cachePath = pathManager.getSummaryCachePath();
    
    try {
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
        logger.debug(`[summaryCache] Saved summary cache to ${cachePath}`);
    } catch (error) {
        logger.error('[summaryCache] Error saving summary cache:', error);
    }
}

/**
 * Get cached summary data
 * @returns {Object} The cached summary data or null if not available
 */
function getCachedSummary() {
    return summaryCache.data;
}

/**
 * Check if cache is still valid based on age and transaction status
 * @param {number} transactionCount Current number of transactions
 * @param {string} transactionTimestamp Latest transaction modification timestamp
 * @returns {boolean} True if cache is valid, false if it needs updating
 */
function isCacheValid(transactionCount = null, transactionTimestamp = null) {
    if (!summaryCache.lastUpdated) return false;
    
    // Check cache age
    const cacheAge = Date.now() - new Date(summaryCache.lastUpdated).getTime();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    // If cache is too old, invalidate it
    if (cacheAge >= maxAge) {
        return false;
    }
    
    // If transaction count provided, check if it matches
    if (transactionCount !== null && 
        summaryCache.transactionCount !== transactionCount) {
        logger.debug(`[summaryCache] Transaction count changed from ${summaryCache.transactionCount} to ${transactionCount}, invalidating cache`);
        return false;
    }
    
    // If transaction timestamp provided, check if it's newer than cache
    if (transactionTimestamp && summaryCache.transactionTimestamp) {
        const cachedTimestamp = new Date(summaryCache.transactionTimestamp).getTime();
        const newTimestamp = new Date(transactionTimestamp).getTime();
        
        if (newTimestamp > cachedTimestamp) {
            logger.debug(`[summaryCache] Transactions were modified after cache was created, invalidating cache`);
            return false;
        }
    }
    
    return true;
}

/**
 * Update the summary cache with new data
 * @param {Object} summaryData The new summary data
 * @param {number} transactionCount Current number of transactions
 * @param {string} transactionTimestamp Latest transaction modification timestamp
 */
function updateCache(summaryData, transactionCount = null, transactionTimestamp = null) {
    summaryCache = {
        data: summaryData,
        lastUpdated: new Date().toISOString(),
        isUpdating: false,
        transactionCount: transactionCount || summaryCache.transactionCount,
        transactionTimestamp: transactionTimestamp || summaryCache.transactionTimestamp
    };
    
    saveCache(summaryCache);
}

/**
 * Invalidate the cache when transactions are modified
 * This should be called whenever transactions are added, deleted, or modified
 */
function invalidateCache() {
    logger.debug('[summaryCache] Invalidating cache due to transaction changes');
    summaryCache.lastUpdated = null;
    saveCache(summaryCache);
}

/**
 * Generate summary data using the provided calculation function
 * @param {Function} calculateSummary Function that calculates the summary
 * @param {number} transactionCount Current number of transactions
 * @param {string} transactionTimestamp Latest transaction modification timestamp 
 * @returns {Promise<Object>} The updated summary data
 */
async function generateSummary(calculateSummary, transactionCount = null, transactionTimestamp = null) {
    // Prevent multiple simultaneous updates
    if (summaryCache.isUpdating) {
        logger.debug('[summaryCache] Summary generation already in progress');
        return summaryCache.data;
    }
    
    summaryCache.isUpdating = true;
    
    try {
        logger.debug('[summaryCache] Generating fresh summary data');
        const freshSummary = await calculateSummary();
        updateCache(freshSummary, transactionCount, transactionTimestamp);
        return freshSummary;
    } catch (error) {
        logger.error('[summaryCache] Error generating summary:', error);
        summaryCache.isUpdating = false;
        return summaryCache.data;
    }
}

/**
 * Get summary data (from cache if valid, otherwise generates new data)
 * @param {Function} calculateSummary Function that calculates the summary
 * @param {boolean} forceFresh Whether to force a fresh calculation
 * @param {number} transactionCount Current number of transactions
 * @param {string} transactionTimestamp Latest transaction modification timestamp
 * @returns {Promise<Object>} The summary data
 */
async function getSummary(calculateSummary, forceFresh = false, transactionCount = null, transactionTimestamp = null) {
    if (!forceFresh && isCacheValid(transactionCount, transactionTimestamp)) {
        logger.debug('[summaryCache] Using valid cached summary data');
        return summaryCache.data;
    }
    
    return generateSummary(calculateSummary, transactionCount, transactionTimestamp);
}

/**
 * Schedule periodic updates of the summary cache
 * @param {Function} calculateSummary Function that calculates the summary
 * @param {Function} getTransactionInfo Function that returns transaction count and timestamp
 * @param {number} intervalMs Update interval in milliseconds (default: 5 minutes)
 */
function scheduleUpdates(calculateSummary, getTransactionInfo = null, intervalMs = 5 * 60 * 1000) {
    logger.debug(`[summaryCache] Scheduling summary cache updates every ${intervalMs/1000} seconds`);
    
    setInterval(async () => {
        try {
            // Only update if not already updating and if prices or transactions have changed
            let transactionCount = null;
            let transactionTimestamp = null;
            
            // Get current transaction info if function provided
            if (getTransactionInfo) {
                const info = getTransactionInfo();
                transactionCount = info.count;
                transactionTimestamp = info.timestamp;
            }
            
            const priceChanged = priceCache.hasPriceChanged();
            const cacheValid = isCacheValid(transactionCount, transactionTimestamp);
            
            if (!summaryCache.isUpdating && (!cacheValid || priceChanged)) {
                logger.debug('[summaryCache] Running scheduled summary update - ' + 
                            (priceChanged ? 'Price changed' : 'Cache invalid'));
                await generateSummary(calculateSummary, transactionCount, transactionTimestamp);
            }
        } catch (error) {
            logger.error('[summaryCache] Error in scheduled update:', error);
        }
    }, intervalMs);
}

/**
 * Clear the existing cache file and reset to an empty state
 * This can be called manually when needed (e.g. after server updates)
 */
function clearCache() {
    logger.debug('[summaryCache] Clearing summary cache');
    summaryCache = { 
        data: null, 
        lastUpdated: null, 
        isUpdating: false,
        transactionCount: 0,
        transactionTimestamp: null
    };
    saveCache(summaryCache);
}

// Initialize the cache on module load
initializeCache();

module.exports = {
    getCachedSummary,
    isCacheValid,
    updateCache,
    generateSummary,
    getSummary,
    scheduleUpdates,
    invalidateCache,
    clearCache
}; 