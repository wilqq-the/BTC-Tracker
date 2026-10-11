import { NextRequest, NextResponse } from 'next/server';
import { BTCProjectionService } from '@/lib/btc-projection-service';
import { withAuth } from '@/lib/auth-helpers';

// GET - Fetch all price scenarios
export async function GET(request: NextRequest) {
  return withAuth(request, () => getScenarios(request));
}

async function getScenarios(request: NextRequest) {
  try {
    const scenarios = await BTCProjectionService.getScenarios();
    
    return NextResponse.json({
      success: true,
      data: scenarios
    });
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch scenarios'
    }, { status: 500 });
  }
}



