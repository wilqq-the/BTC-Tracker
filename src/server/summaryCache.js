const fs = require('fs').promises;
const path = require('path');
const pathManager = require('./utils/path-manager');

class SummaryCache {
    constructor() {
        this.cache = {
            data: null,
            timestamp: null
        };
        this.cacheFilePath = pathManager.getSummaryCachePath();
        this.updateInterval = 15 * 60 * 1000; // 15 minutes
        this.isUpdating = false;
        this.updateTimer = null;
        this.transactionCount = 0;
        this.transactionTimestamp = null;
    }

    async initialize() {
        try {
            // Create data directory if it doesn't exist
            const dataDir = path.dirname(this.cacheFilePath);
            await fs.mkdir(dataDir, { recursive: true });

            // Try to load cached data from disk
            await this.loadFromDisk();
            
            console.log('[summaryCache] Initialized');
        } catch (error) {
            console.error('[summaryCache] Initialization error:', error);
        }
    }

    async loadFromDisk() {
        try {
            const data = await fs.readFile(this.cacheFilePath, 'utf8');
            const cachedData = JSON.parse(data);
            
            if (cachedData && cachedData.data && cachedData.timestamp) {
                this.cache = cachedData;
                console.log('[summaryCache] Loaded from disk, timestamp:', cachedData.timestamp);
                return true;
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('[summaryCache] Error loading from disk:', error);
            } else {
                console.log('[summaryCache] No cache file found, will create one');
            }
        }
        return false;
    }

    async saveToDisk() {
        try {
            await fs.writeFile(
                this.cacheFilePath,
                JSON.stringify(this.cache, null, 2),
                'utf8'
            );
            console.log('[summaryCache] Saved to disk');
        } catch (error) {
            console.error('[summaryCache] Error saving to disk:', error);
        }
    }

    isCacheFresh(transactionCount, transactionTimestamp) {
        if (!this.cache.data || !this.cache.timestamp) {
            console.log('[summaryCache] Cache is empty');
            return false;
        }

        const cacheAge = Date.now() - new Date(this.cache.timestamp).getTime();
        
        // If cache is older than the update interval, it's not fresh
        if (cacheAge > this.updateInterval) {
            console.log(`[summaryCache] Cache is too old: ${cacheAge}ms`);
            return false;
        }
        
        // If transaction count has changed, cache is not fresh
        if (this.transactionCount !== transactionCount) {
            console.log(`[summaryCache] Transaction count changed: ${this.transactionCount} -> ${transactionCount}`);
            return false;
        }
        
        // If latest transaction timestamp is newer than our cache, it's not fresh
        if (this.transactionTimestamp && transactionTimestamp && 
            new Date(transactionTimestamp) > new Date(this.transactionTimestamp)) {
            console.log(`[summaryCache] Transaction timestamp is newer: ${this.transactionTimestamp} -> ${transactionTimestamp}`);
            return false;
        }
        
        console.log('[summaryCache] Cache is fresh');
        return true;
    }

    invalidateCache() {
        console.log('[summaryCache] Invalidating cache');
        this.cache.data = null;
        this.cache.timestamp = null;
        this.transactionCount = 0;
        this.transactionTimestamp = null;
    }

    clearCache() {
        console.log('[summaryCache] Clearing cache');
        this.invalidateCache();
        this.saveToDisk().catch(err => console.error('[summaryCache] Error saving cleared cache:', err));
    }

    async getSummary(calculateFunction, forceFresh = false, transactionCount = 0, transactionTimestamp = null) {
        // If force fresh or cache isn't valid, calculate a new summary
        if (forceFresh || !this.isCacheFresh(transactionCount, transactionTimestamp)) {
            console.log('[summaryCache] Generating fresh summary data');
            try {
                const freshData = await calculateFunction();
                
                // Update the cache
                this.cache = {
                    data: freshData,
                    timestamp: new Date().toISOString()
                };
                
                // Update transaction tracking
                this.transactionCount = transactionCount;
                this.transactionTimestamp = transactionTimestamp;
                
                // Save to disk
                await this.saveToDisk();
                
                return freshData;
            } catch (error) {
                console.error('[summaryCache] Error calculating fresh summary:', error);
                
                // If we have cached data, return it as a fallback
                if (this.cache.data) {
                    console.log('[summaryCache] Returning stale cache as fallback');
                    return this.cache.data;
                }
                
                throw error;
            }
        } else {
            console.log('[summaryCache] Returning cached summary data');
            return this.cache.data;
        }
    }

    scheduleUpdates(calculateFunction, getTransactionInfoFunction) {
        // Clear any existing timer
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        // Schedule periodic updates
        this.updateTimer = setInterval(async () => {
            if (this.isUpdating) return;
            
            this.isUpdating = true;
            try {
                // Get current transaction info
                const transactionInfo = getTransactionInfoFunction();
                
                // Check if we need to update
                if (!this.isCacheFresh(transactionInfo.count, transactionInfo.timestamp)) {
                    console.log('[summaryCache] Running scheduled update');
                    const freshData = await calculateFunction();
                    
                    // Update the cache
                    this.cache = {
                        data: freshData,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Update transaction tracking
                    this.transactionCount = transactionInfo.count;
                    this.transactionTimestamp = transactionInfo.timestamp;
                    
                    // Save to disk
                    await this.saveToDisk();
                }
            } catch (error) {
                console.error('[summaryCache] Error in scheduled update:', error);
            } finally {
                this.isUpdating = false;
            }
        }, this.updateInterval);
        
        console.log(`[summaryCache] Scheduled updates every ${this.updateInterval / 1000} seconds`);
    }
}

// Export a singleton instance
const summaryCache = new SummaryCache();
summaryCache.initialize().catch(err => console.error('[summaryCache] Error during initialization:', err));
module.exports = summaryCache; 