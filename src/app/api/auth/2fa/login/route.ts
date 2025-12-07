import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticator } from 'otplib';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// POST - Verify 2FA code during login
// This is called after password verification when 2FA is enabled
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, tempToken } = body;

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: 'Email and verification code are required' },
        { status: 400 }
      );
    }

    // Verify the temporary token (proves password was already verified)
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Verify temp token
    try {
      const decoded = jwt.verify(tempToken, secret) as { email: string; purpose: string };
      if (decoded.email !== email || decoded.purpose !== '2fa-pending') {
        throw new Error('Invalid token');
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Session expired. Please login again.' },
        { status: 401 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    // Clean the code (remove spaces, uppercase for backup codes)
    const cleanCode = code.replace(/\s/g, '');
    let isValidCode = false;
    let usedBackupCode = false;

    // Try TOTP verification first
    isValidCode = authenticator.verify({
      token: cleanCode,
      secret: user.twoFactorSecret
    });

    // If TOTP didn't work, try backup codes
    if (!isValidCode && user.twoFactorBackupCodes) {
      const hashedBackupCodes: string[] = JSON.parse(user.twoFactorBackupCodes);
      const upperCode = cleanCode.toUpperCase();
      
      for (let i = 0; i < hashedBackupCodes.length; i++) {
        const isMatch = await bcrypt.compare(upperCode, hashedBackupCodes[i]);
        if (isMatch) {
          isValidCode = true;
          usedBackupCode = true;
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

    // Return success - the client will complete the NextAuth sign-in
    return NextResponse.json({
      success: true,
      verified: true,
      usedBackupCode,
      message: usedBackupCode 
        ? '2FA verified with backup code. Consider generating new backup codes.' 
        : '2FA verified successfully'
    });

  } catch (error) {
    console.error('2FA login verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}

// GET - Check if user has 2FA enabled (public endpoint for login flow)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { twoFactorEnabled: true }
    });

    // Don't reveal if user exists - just return false if not found
    return NextResponse.json({
      success: true,
      twoFactorEnabled: user?.twoFactorEnabled || false
    });

  } catch (error) {
    console.error('2FA check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check 2FA status' },
      { status: 500 }
    );
  }
}

