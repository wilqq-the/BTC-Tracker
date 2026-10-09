import { NextRequest, NextResponse } from 'next/server';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { withAuth, withAdminAuth } from '@/lib/auth-helpers';

// GET current Bitcoin price (any authenticated user)
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const priceData = await BitcoinPriceService.getCurrentPrice();

      return NextResponse.json({
        success: true,
        data: priceData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching Bitcoin price:', error);

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch Bitcoin price',
        data: {
          price: 105000, // Fallback price
          timestamp: new Date().toISOString(),
          source: 'fallback',
          priceChange24h: 0,
          priceChangePercent24h: 0
        }
      }, { status: 500 });
    }
  });
}

// POST trigger manual price refresh and portfolio recalculation (admin only:
// it clears the server-wide price cache and recomputes the shared summary)
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      BitcoinPriceService.clearCache();
      const priceData = await BitcoinPriceService.getCurrentPrice();

      // Handle null price data
      if (!priceData) {
        return NextResponse.json({
          success: false,
          error: 'Unable to fetch price data',
          message: 'Price service returned no data'
        }, { status: 500 });
      }

      // Try to recalculate portfolio summary, but don't fail if it errors
      let portfolioUpdateMessage = 'and portfolio updated';
      try {
        await BitcoinPriceService.calculateAndStorePortfolioSummary(priceData.price);
      } catch (portfolioError) {
        console.error('Error updating portfolio after price refresh:', portfolioError);
        portfolioUpdateMessage = 'but portfolio update failed';
      }

      return NextResponse.json({
        success: true,
        data: priceData,
        message: `Price cache cleared, refreshed, ${portfolioUpdateMessage}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error refreshing Bitcoin price:', error);

      return NextResponse.json({
        success: false,
        error: 'Failed to refresh Bitcoin price'
      }, { status: 500 });
    }
  });
}
