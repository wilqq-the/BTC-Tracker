import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';

// DELETE - Delete a goal
export async function DELETE(
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

      // Verify the goal belongs to the user before deleting
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

      // Soft delete by setting isActive to false
      await prisma.goal.update({
        where: { id: goalId },
        data: { isActive: false }
      });

      return NextResponse.json({
        success: true,
        message: 'Goal deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting goal:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete goal'
      }, { status: 500 });
    }
  });
}

// PUT - Mark goal as completed
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId, user) => {
    try {
      const params = await context.params;
      const goalId = parseInt(params.id);
      const body = await request.json();

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

      // Update goal
      const updatedGoal = await prisma.goal.update({
        where: { id: goalId },
        data: {
          isCompleted: body.is_completed ?? goal.isCompleted,
          completedAt: body.is_completed ? new Date() : null
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          id: updatedGoal.id,
          is_completed: updatedGoal.isCompleted,
          completed_at: updatedGoal.completedAt?.toISOString()
        },
        message: 'Goal updated successfully'
      });
    } catch (error) {
      console.error('Error updating goal:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update goal'
      }, { status: 500 });
    }
  });
}



