import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';
import { BTCProjectionService } from '@/lib/btc-projection-service';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { ExchangeRateService } from '@/lib/exchange-rate-service';
import { SettingsService } from '@/lib/settings-service';

// POST - Recalculate a goal based on current BTC price
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId, user) => {
    try {
      const params = await context.params;
      const goalId = parseInt(params.id);

      if (isNaN(goalId)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid goal ID'
        }, { status: 400 });
      }

      // Verify the goal belongs to the user
      const goal = await prisma.goal.findFirst({
        where: {
          id: goalId,
          userId: userId
        }
      });

      if (!goal) {
        return NextResponse.json({
          success: false,
          error: 'Goal not found'
        }, { status: 404 });
      }

      // Get current BTC price (in USD)
      const currentPriceData = await BitcoinPriceService.getCurrentPrice();
      const currentBtcPriceUSD = currentPriceData?.price || 100000;
      
      // Get user's CURRENT main currency (may have changed since goal was created)
      const settings = await SettingsService.getSettings();
      const mainCurrency = settings.currency.mainCurrency;
      
      // Convert current BTC price from USD to current main currency
      const usdToMainRate = await ExchangeRateService.getExchangeRate('USD', mainCurrency);
      const currentBtcPrice = currentBtcPriceUSD * usdToMainRate;
      
      // Convert goal's initial BTC price (stored in goal.currency at creation) to current main currency
      // This handles cases where user changed their main currency after creating the goal
      const goalCurrencyToMainRate = await ExchangeRateService.getExchangeRate(goal.currency, mainCurrency);
      const initialBtcPriceInMain = goal.initialBtcPrice * goalCurrencyToMainRate;

      // Calculate remaining time
      const targetDate = new Date(goal.targetDate);
      const today = new Date();
      const remainingMonths = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30));

      // Get user's current BTC holdings
      const allTransactions = await prisma.bitcoinTransaction.findMany({
        where: { userId: userId }
      });
      
      const totalBtcBought = allTransactions.filter(tx => tx.type === 'BUY').reduce((sum, tx) => sum + tx.btcAmount, 0);
      const totalBtcSold = allTransactions.filter(tx => tx.type === 'SELL').reduce((sum, tx) => sum + tx.btcAmount, 0);
      const currentHoldings = totalBtcBought - totalBtcSold;

      // Calculate BTC still needed
      const btcStillNeeded = Math.max(0, goal.targetBtcAmount - currentHoldings);

      if (btcStillNeeded <= 0) {
        return NextResponse.json({
          success: true,
          data: {
            goal_achieved: true,
            message: 'Congratulations! You have already reached your goal!',
            current_holdings: currentHoldings,
            target: goal.targetBtcAmount,
            surplus: currentHoldings - goal.targetBtcAmount
          }
        });
      }

      if (remainingMonths <= 0) {
        return NextResponse.json({
          success: true,
          data: {
            goal_expired: true,
            message: 'Target date has passed. Consider extending your timeline.',
            current_holdings: currentHoldings,
            btc_still_needed: btcStillNeeded,
            target: goal.targetBtcAmount
          }
        });
      }

      // Get the scenario for this goal
      const scenarios = await BTCProjectionService.getScenarios();
      let goalScenario = scenarios.find(s => s.id === goal.priceScenario) || scenarios.find(s => s.id === 'stable')!;

      // If custom scenario, use the stored growth rate from the goal
      if (goal.priceScenario === 'custom') {
        goalScenario = {
          ...goalScenario,
          annualGrowthRate: goal.scenarioGrowthRate,
          basis: `Custom: ${goal.scenarioGrowthRate >= 0 ? '+' : ''}${(goal.scenarioGrowthRate * 100).toFixed(0)}%/yr`
        };
      }

      // Calculate new projection using the SAME scenario
      const newProjection = BTCProjectionService.calculateScenarioProjection(
        goalScenario,
        currentBtcPrice,
        btcStillNeeded,
        remainingMonths
      );

      // Calculate progress
      const progressPercent = ((currentHoldings / goal.targetBtcAmount) * 100);
      
      // Calculate expected holdings based on linear progress from initial holdings to target
      // Use the goal's stored initial holdings (at creation time) for this calculation
      const initialHoldings = goal.currentHoldings;
      const monthsElapsed = goal.totalMonths - remainingMonths;
      const expectedHoldings = initialHoldings + 
                               ((goal.targetBtcAmount - initialHoldings) * (monthsElapsed / goal.totalMonths));
      const isOnTrack = currentHoldings >= expectedHoldings * 0.95; // 5% tolerance

      // Compare original vs current (both in mainCurrency now)
      const priceChange = ((currentBtcPrice - initialBtcPriceInMain) / initialBtcPriceInMain) * 100;
      const monthlyChange = ((newProjection.averageMonthlyFiat - goal.monthlyFiatNeeded) / goal.monthlyFiatNeeded) * 100;

      return NextResponse.json({
        success: true,
        data: {
          // Original plan
          original: {
            initial_btc_price: goal.initialBtcPrice,
            final_btc_price: goal.finalBtcPrice,
            monthly_fiat: goal.monthlyFiatNeeded,
            total_fiat: goal.totalFiatNeeded,
            total_months: goal.totalMonths,
            scenario: goal.priceScenario
          },
          // Current status
          current: {
            btc_price: currentBtcPrice,
            price_change_percent: priceChange,
            current_holdings: currentHoldings,
            btc_still_needed: btcStillNeeded,
            remaining_months: remainingMonths,
            progress_percent: progressPercent,
            expected_holdings: expectedHoldings,
            is_on_track: isOnTrack
          },
          // New projection
          projection: {
            monthly_fiat_needed: newProjection.averageMonthlyFiat,
            monthly_change_percent: monthlyChange,
            total_fiat_needed: newProjection.totalFiatNeeded,
            final_btc_price: newProjection.finalProjectedPrice,
            scenario: goalScenario
          },
          // Recommendations
          recommendations: {
            action: isOnTrack ? 'stay_course' : 'increase_investment',
            message: isOnTrack 
              ? '✅ You are on track to meet your goal!' 
              : monthlyChange > 0
                ? `⚠️ Consider increasing monthly investment by €${Math.abs(newProjection.averageMonthlyFiat - goal.monthlyFiatNeeded).toFixed(0)} or extending timeline`
                : '✅ BTC price drop means you can invest less and still meet your goal',
            suggested_monthly: newProjection.averageMonthlyFiat
          }
        }
      });

    } catch (error) {
      console.error('Error recalculating goal:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to recalculate goal'
      }, { status: 500 });
    }
  });
}


