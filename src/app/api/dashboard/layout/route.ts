import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DEFAULT_LAYOUT } from '@/lib/dashboard-constants';
import { DashboardLayout } from '@/lib/dashboard-types';

/**
 * GET /api/dashboard/layout
 * Get user's dashboard layout configuration
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        dashboardLayout: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Return saved layout or default layout
    if (user.dashboardLayout && user.dashboardLayout.layout) {
      try {
        const layout = JSON.parse(user.dashboardLayout.layout) as DashboardLayout;
        return NextResponse.json({
          success: true,
          data: layout,
        });
      } catch (error) {
        console.error('Error parsing saved layout:', error);
        // If parsing fails, return default layout
        return NextResponse.json({
          success: true,
          data: DEFAULT_LAYOUT,
        });
      }
    }

    // No saved layout, return default
    return NextResponse.json({
      success: true,
      data: DEFAULT_LAYOUT,
    });
  } catch (error) {
    console.error('Error fetching dashboard layout:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/layout
 * Save user's dashboard layout configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { layout } = body;

    if (!layout || !layout.widgets) {
      return NextResponse.json(
        { success: false, error: 'Invalid layout data' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Save layout as JSON string
    const layoutJson = JSON.stringify(layout);

    // Upsert dashboard layout
    await prisma.dashboardLayout.upsert({
      where: { userId: user.id },
      update: {
        layout: layoutJson,
      },
      create: {
        userId: user.id,
        layout: layoutJson,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Layout saved successfully',
    });
  } catch (error) {
    console.error('Error saving dashboard layout:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/layout
 * Reset dashboard layout to default
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete saved layout
    await prisma.dashboardLayout.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Layout reset to default',
    });
  } catch (error) {
    console.error('Error resetting dashboard layout:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

