import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// POST - Generate 2FA secret and QR code for setup
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: '2FA is already enabled. Disable it first to set up again.' },
        { status: 400 }
      );
    }

    // Generate a new secret
    const secret = authenticator.generateSecret();
    
    // Create the otpauth URL for the authenticator app
    const appName = 'BTC Tracker';
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret);
    
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    // Store the secret temporarily (not enabled yet)
    // The secret will be confirmed when user verifies with a code
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret,
        // Don't enable yet - wait for verification
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        secret, // Show to user for manual entry
        qrCode: qrCodeDataUrl,
        otpauthUrl // For debugging/advanced users
      },
      message: 'Scan the QR code with your authenticator app, then verify with a code'
    });

  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
}

// GET - Check 2FA status for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        twoFactorEnabled: true,
        twoFactorSecret: true // Check if setup is in progress
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        enabled: user.twoFactorEnabled,
        setupInProgress: !user.twoFactorEnabled && !!user.twoFactorSecret
      }
    });

  } catch (error) {
    console.error('2FA status check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check 2FA status' },
      { status: 500 }
    );
  }
}

