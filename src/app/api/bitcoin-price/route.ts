import { NextRequest, NextResponse } from 'next/server';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';

// GET current Bitcoin price or portfolio summary
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    // Handle portfolio summary request
    if (endpoint === 'portfolio') {
      const portfolioSummary = await BitcoinPriceService.getPortfolioSummary();
      
      return NextResponse.json({
        success: true,
        data: portfolioSummary,
        timestamp: new Date().toISOString()
      });
    }

    // Default: return current Bitcoin price
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
}

// POST trigger manual price and portfolio update
export async function POST(request: NextRequest): Promise<NextResponse> {
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
} 