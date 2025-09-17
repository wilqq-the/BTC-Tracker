import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth-helpers';

// GET - Get system statistics (admin only)
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (adminUserId, adminUser) => {
    try {
      // Get user statistics (no sensitive financial data)
      const [
        totalUsers,
        activeUsers,
        adminUsers,
        totalTransactions,
        usersWithTransactions
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isAdmin: true } }),
        prisma.bitcoinTransaction.count(),
        prisma.user.count({
          where: {
            transactions: {
              some: {}
            }
          }
        })
      ]);

      const stats = {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          admins: adminUsers
        },
        system: {
          totalTransactions: totalTransactions,
          activeUsers: usersWithTransactions
        }
      };

      return NextResponse.json({
        success: true,
        data: stats,
        message: 'System statistics retrieved successfully'
      });

    } catch (error) {
      console.error('Error fetching admin stats:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch system statistics'
      }, { status: 500 });
    }
  });
}
