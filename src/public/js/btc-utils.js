// BTC Utils - Bitcoin and Satoshi conversion utilities
// 1 BTC = 100,000,000 Satoshis

// Constants
const SATOSHIS_PER_BTC = 100000000;

// Global BTC unit preference (will be set from settings)
window.currentBtcUnit = 'btc'; // Default to BTC

// Conversion functions
function btcToSatoshis(btcAmount) {
    return Math.round(btcAmount * SATOSHIS_PER_BTC);
}

function satoshisToBtc(satoshis) {
    return satoshis / SATOSHIS_PER_BTC;
}

// Format BTC amount based on current unit preference
function formatBtcAmount(btcAmount, unit = null) {
    const displayUnit = unit || window.currentBtcUnit || 'btc';
    
    if (displayUnit === 'satoshi' || displayUnit === 'sats') {
        const satoshis = btcToSatoshis(btcAmount);
        return {
            value: satoshis,
            formatted: satoshis.toLocaleString(),
            unit: '<i class="fak fa-satoshisymbol-solid"></i>',
            symbol: '<i class="fak fa-satoshisymbol-solid"></i>'
        };
    } else {
        return {
            value: btcAmount,
            formatted: btcAmount.toFixed(8).replace(/\.?0+$/, ''),
            unit: 'BTC',
            symbol: '₿'
        };
    }
}

// Format BTC amount for display with unit
function formatBtcDisplay(btcAmount, unit = null) {
    const formatted = formatBtcAmount(btcAmount, unit);
    return `${formatted.formatted} ${formatted.unit}`;
}

// Format BTC amount for display with unit (text-only version for HTML attributes)
function formatBtcDisplayText(btcAmount, unit = null) {
    const displayUnit = unit || window.currentBtcUnit || 'btc';
    
    if (displayUnit === 'satoshi' || displayUnit === 'sats') {
        const satoshis = btcToSatoshis(btcAmount);
        return `${satoshis.toLocaleString()} sats`;
    } else {
        return `${btcAmount.toFixed(8).replace(/\.?0+$/, '')} BTC`;
    }
}

// Parse user input based on current unit and return BTC amount
function parseUserBtcInput(inputValue, unit = null) {
    const displayUnit = unit || window.currentBtcUnit || 'btc';
    const numValue = parseFloat(inputValue) || 0;
    
    if (displayUnit === 'satoshi' || displayUnit === 'sats') {
        // Convert satoshis to BTC
        return satoshisToBtc(numValue);
    } else {
        // Already in BTC
        return numValue;
    }
}

// Get BTC input step value based on current unit
function getBtcInputStep(unit = null) {
    const displayUnit = unit || window.currentBtcUnit || 'btc';
    
    if (displayUnit === 'satoshi' || displayUnit === 'sats') {
        return '1'; // Whole satoshis
    } else {
        return '0.00000001'; // 1 satoshi precision in BTC
    }
}

// Get BTC input placeholder based on current unit
function getBtcInputPlaceholder(unit = null) {
    const displayUnit = unit || window.currentBtcUnit || 'btc';
    
    if (displayUnit === 'satoshi' || displayUnit === 'sats') {
        return '12345678'; // Example in satoshis
    } else {
        return '0.12345678'; // Example in BTC
    }
}

// Convert BTC amount to display format for input fields
function btcToDisplayInput(btcAmount, unit = null) {
    const displayUnit = unit || window.currentBtcUnit || 'btc';
    
    if (displayUnit === 'satoshi' || displayUnit === 'sats') {
        return btcToSatoshis(btcAmount).toString();
    } else {
        return btcAmount.toString();
    }
}

// Validate BTC input based on current unit
function validateBtcInput(inputValue, unit = null) {
    const displayUnit = unit || window.currentBtcUnit || 'btc';
    const numValue = parseFloat(inputValue);
    
    if (isNaN(numValue) || numValue < 0) {
        return {
            valid: false,
            error: 'Please enter a valid positive number'
        };
    }
    
    if (displayUnit === 'satoshi' || displayUnit === 'sats') {
        // Check if it's a whole number for satoshis
        if (numValue !== Math.floor(numValue)) {
            return {
                valid: false,
                error: 'Satoshi amounts must be whole numbers'
            };
        }
        
        // Check maximum value (21M BTC in satoshis)
        if (numValue > 21000000 * SATOSHIS_PER_BTC) {
            return {
                valid: false,
                error: 'Amount exceeds maximum possible Bitcoin supply'
            };
        }
    } else {
        // BTC validation
        if (numValue > 21000000) {
            return {
                valid: false,
                error: 'Amount exceeds maximum possible Bitcoin supply (21M BTC)'
            };
        }
        
        // Check satoshi precision (8 decimal places max)
        const btcPrecision = (inputValue.toString().split('.')[1] || '').length;
        if (btcPrecision > 8) {
            return {
                valid: false,
                error: 'Maximum precision is 8 decimal places (1 satoshi)'
            };
        }
    }
    
    return { valid: true };
}

// Update BTC unit preference and refresh displays
function updateBtcUnit(newUnit) {
    const oldUnit = window.currentBtcUnit;
    window.currentBtcUnit = newUnit;
    
    console.log(`BTC unit changed from ${oldUnit} to ${newUnit}`);
    
    // Trigger update event for components to refresh
    const event = new CustomEvent('btcUnitChanged', {
        detail: { oldUnit, newUnit }
    });
    window.dispatchEvent(event);
}

// Get help text for BTC input based on current unit
function getBtcInputHelpText(unit = null) {
    const displayUnit = unit || window.currentBtcUnit || 'btc';
    
    if (displayUnit === 'satoshi' || displayUnit === 'sats') {
        return 'Enter amount in Satoshis (whole numbers only). 1 BTC = 100,000,000 Satoshis (sats)';
    } else {
        return 'Maximum precision: 8 decimal places (1 satoshi = 0.00000001 BTC)';
    }
}

// Initialize BTC utils when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Listen for settings changes to update BTC unit
    window.addEventListener('storage', function(e) {
        if (e.key === 'btc_tracker_settings_updated') {
            // Settings were updated, refetch them
            fetchBtcUnitSetting();
        }
    });
    
    // Initial load of BTC unit setting
    fetchBtcUnitSetting();
    
    // Update labels after a short delay to ensure page elements are loaded
    setTimeout(() => {
        if (typeof updateBtcLabels === 'function') {
            updateBtcLabels();
        }
    }, 100);
});

// Fetch BTC unit setting from server
async function fetchBtcUnitSetting() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            const settings = await response.json();
            const newUnit = settings.btcUnit || 'btc';
            
            if (window.currentBtcUnit !== newUnit) {
                updateBtcUnit(newUnit);
            }
        }
    } catch (error) {
        console.warn('Failed to fetch BTC unit setting:', error);
        // Keep current setting or default
    }
} 