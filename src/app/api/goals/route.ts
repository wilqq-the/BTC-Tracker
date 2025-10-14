import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';

// GET - Fetch all goals for the authenticated user
export async function GET(request: NextRequest) {
  return withAuth(request, async (userId, user) => {
    try {
      const goals = await prisma.goal.findMany({
        where: {
          userId: userId,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Format goals for frontend
      const formattedGoals = goals.map(goal => ({
        id: goal.id,
        name: goal.name,
        target_btc_amount: goal.targetBtcAmount,
        target_date: goal.targetDate.toISOString().split('T')[0],
        current_holdings: goal.currentHoldings,
        monthly_budget: goal.monthlyBudget,
        currency: goal.currency,
        // Scenario data
        price_scenario: goal.priceScenario,
        scenario_growth_rate: goal.scenarioGrowthRate,
        // Calculated values
        monthly_btc_needed: goal.monthlyBtcNeeded,
        monthly_fiat_needed: goal.monthlyFiatNeeded,
        total_fiat_needed: goal.totalFiatNeeded,
        total_months: goal.totalMonths,
        initial_btc_price: goal.initialBtcPrice,
        final_btc_price: goal.finalBtcPrice,
        // Status
        is_completed: goal.isCompleted,
        completed_at: goal.completedAt?.toISOString().split('T')[0],
        created_at: goal.createdAt.toISOString(),
        updated_at: goal.updatedAt.toISOString()
      }));

      return NextResponse.json({
        success: true,
        data: formattedGoals,
        message: 'Goals retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching goals:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch goals'
      }, { status: 500 });
    }
  });
}

// POST - Create a new goal
export async function POST(request: NextRequest) {
  return withAuth(request, async (userId, user) => {
    try {
      const body = await request.json();

      // Validate required fields
      if (!body.target_btc_amount || !body.target_date) {
        return NextResponse.json({
          success: false,
          error: 'Target BTC amount and date are required'
        }, { status: 400 });
      }

      // Create goal
      const goal = await prisma.goal.create({
        data: {
          userId: userId,
          name: body.name || 'Bitcoin Savings Goal',
          targetBtcAmount: parseFloat(body.target_btc_amount),
          targetDate: new Date(body.target_date),
          currentHoldings: parseFloat(body.current_holdings || '0'),
          monthlyBudget: body.monthly_budget ? parseFloat(body.monthly_budget) : null,
          currency: body.currency || 'EUR',
          // Scenario data
          priceScenario: body.price_scenario || 'stable',
          scenarioGrowthRate: parseFloat(body.scenario_growth_rate || '0'),
          // Calculated values
          monthlyBtcNeeded: parseFloat(body.monthly_btc_needed),
          monthlyFiatNeeded: parseFloat(body.monthly_fiat_needed),
          totalFiatNeeded: parseFloat(body.total_fiat_needed || '0'),
          totalMonths: parseInt(body.total_months),
          initialBtcPrice: parseFloat(body.initial_btc_price || '0'),
          finalBtcPrice: parseFloat(body.final_btc_price || '0')
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          id: goal.id,
          name: goal.name,
          target_btc_amount: goal.targetBtcAmount,
          target_date: goal.targetDate.toISOString().split('T')[0],
          current_holdings: goal.currentHoldings,
          monthly_budget: goal.monthlyBudget,
          currency: goal.currency,
          monthly_btc_needed: goal.monthlyBtcNeeded,
          monthly_fiat_needed: goal.monthlyFiatNeeded,
          total_months: goal.totalMonths,
          created_at: goal.createdAt.toISOString()
        },
        message: 'Goal created successfully'
      }, { status: 201 });
    } catch (error) {
      console.error('Error creating goal:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create goal'
      }, { status: 500 });
    }
  });
}

