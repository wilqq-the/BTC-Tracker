import { NextRequest, NextResponse } from 'next/server';
import { BTCProjectionService } from '@/lib/btc-projection-service';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { ExchangeRateService } from '@/lib/exchange-rate-service';
import { SettingsService } from '@/lib/settings-service';

// POST - Calculate DCA strategy for all scenarios
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { target_btc, current_holdings, target_date, selected_scenario, custom_growth_rate } = body;
    
    // Validate inputs
    if (!target_btc || !target_date) {
      return NextResponse.json({
        success: false,
        error: 'Target BTC amount and date are required'
      }, { status: 400 });
    }
    
    // Get current BTC price (in USD)
    const currentPriceData = await BitcoinPriceService.getCurrentPrice();
    const currentBtcPriceUSD = currentPriceData?.price || 100000;
    
    // Get user's main currency and convert
    const settings = await SettingsService.getSettings();
    const mainCurrency = settings.currency.mainCurrency;
    const usdToMainRate = await ExchangeRateService.getExchangeRate('USD', mainCurrency);
    const currentBtcPrice = currentBtcPriceUSD * usdToMainRate;
    
    // Calculate BTC needed
    const holdings = parseFloat(current_holdings || '0');
    const target = parseFloat(target_btc);
    const btcNeeded = target - holdings;
    
    if (btcNeeded <= 0) {
      return NextResponse.json({
        success: true,
        data: {
          already_achieved: true,
          message: 'You already have enough BTC to meet your goal!'
        }
      });
    }
    
    // Calculate months
    const targetDateObj = new Date(target_date);
    const today = new Date();
    const monthsDiff = Math.ceil((targetDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (monthsDiff <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Target date must be in the future'
      }, { status: 400 });
    }
    
    // Calculate all scenarios
    const allScenarios = await BTCProjectionService.calculateAllScenarios(
      currentBtcPrice,
      btcNeeded,
      monthsDiff
    );
    
    // Find selected scenario or default to stable
    let selectedScen = allScenarios.find(s => s.scenario.id === selected_scenario) || 
                       allScenarios.find(s => s.scenario.id === 'stable')!;
    
    // If custom scenario, override with user-defined growth rate
    if (selected_scenario === 'custom' && custom_growth_rate !== undefined) {
      const customScenario = allScenarios.find(s => s.scenario.id === 'custom')!;
      customScenario.scenario.annualGrowthRate = custom_growth_rate;
      customScenario.scenario.basis = `Custom: ${custom_growth_rate >= 0 ? '+' : ''}${(custom_growth_rate * 100).toFixed(0)}%/yr`;
      
      // Recalculate with custom rate
      selectedScen = BTCProjectionService.calculateScenarioProjection(
        customScenario.scenario,
        currentBtcPrice,
        btcNeeded,
        monthsDiff
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        current_btc_price: currentBtcPrice,
        currency: mainCurrency,
        btc_needed: btcNeeded,
        total_months: monthsDiff,
        selected_scenario: selectedScen,
        all_scenarios: allScenarios
      }
    });
    
  } catch (error) {
    console.error('Error calculating DCA strategy:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to calculate DCA strategy'
    }, { status: 500 });
  }
}

