import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { authenticator } from 'otplib';
import bcrypt from 'bcryptjs';

// POST - Disable 2FA (requires current TOTP code or backup code)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code, password } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Verification code is required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required to disable 2FA' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: '2FA is not enabled' },
        { status: 400 }
      );
    }

    // Verify password first
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Try to verify with TOTP code first
    const cleanCode = code.replace(/\s/g, '').toUpperCase();
    let isValidCode = false;

    if (user.twoFactorSecret) {
      isValidCode = authenticator.verify({
        token: cleanCode,
        secret: user.twoFactorSecret
      });
    }

    // If TOTP didn't work, try backup codes
    if (!isValidCode && user.twoFactorBackupCodes) {
      const hashedBackupCodes: string[] = JSON.parse(user.twoFactorBackupCodes);
      
      for (let i = 0; i < hashedBackupCodes.length; i++) {
        const isMatch = await bcrypt.compare(cleanCode, hashedBackupCodes[i]);
        if (isMatch) {
          isValidCode = true;
          // Remove used backup code
          hashedBackupCodes.splice(i, 1);
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorBackupCodes: JSON.stringify(hashedBackupCodes) }
          });
          break;
        }
      }
    }

    if (!isValidCode) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null
      }
    });

    return NextResponse.json({
      success: true,
      message: '2FA has been disabled'
    });

  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}

