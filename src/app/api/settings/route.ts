import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/settings-service';
import { AppSettings } from '@/lib/types';
import { withAuth, withAdminAuth, AuthUser } from '@/lib/auth-helpers';

// NOTE: settings are currently a single server-wide row (not per-user).
// Reads and user-facing sections (currency, display, notifications) require
// any authenticated user; server-level sections (priceData) and a full reset
// require an admin.

const ADMIN_ONLY_CATEGORIES = ['priceData'] as const;

function adminRequired(): NextResponse {
  return NextResponse.json({
    success: false,
    error: 'Admin access required to change server-level settings'
  }, { status: 403 });
}

/**
 * GET /api/settings
 * Get current application settings
 */
export async function GET(request: NextRequest) {
  return withAuth(request, () => getSettings());
}

async function getSettings(): Promise<NextResponse> {
  try {
    const settings = await SettingsService.getSettings();
    
    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Settings retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/settings
 * Create new settings (reset to defaults) — admin only, affects all users
 */
export async function POST(request: NextRequest) {
  return withAdminAuth(request, () => resetSettings());
}

async function resetSettings(): Promise<NextResponse> {
  try {
    const settings = await SettingsService.resetToDefaults();
    
    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Settings reset to defaults successfully'
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to reset settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/settings
 * Update specific settings
 */
export async function PATCH(request: NextRequest) {
  return withAuth(request, (_userId, user) => patchSettings(request, user));
}

async function patchSettings(request: NextRequest, user: AuthUser): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Support both old category-based updates and new direct updates
    if (body.category && body.updates) {
      // Legacy category-based update
      const { category, updates } = body;

      if ((ADMIN_ONLY_CATEGORIES as readonly string[]).includes(category) && !user.isAdmin) {
        return adminRequired();
      }

      let updatedSettings: AppSettings;

      switch (category) {
        case 'currency':
          updatedSettings = await SettingsService.updateCurrencySettings(updates);
          break;
        case 'priceData':
          updatedSettings = await SettingsService.updatePriceDataSettings(updates);
          break;
        case 'display':
          updatedSettings = await SettingsService.updateDisplaySettings(updates);
          break;
        case 'notifications':
          updatedSettings = await SettingsService.updateNotificationSettings(updates);
          break;
        default:
          return NextResponse.json({
            success: false,
            error: 'Invalid category. Must be one of: currency, priceData, display, notifications'
          }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        data: updatedSettings,
        message: `${category} settings updated successfully`
      });
    } else {
      // New direct update approach
      if (!user.isAdmin && body && typeof body === 'object' &&
          ADMIN_ONLY_CATEGORIES.some((key) => key in body)) {
        return adminRequired();
      }

      const currentSettings = await SettingsService.getSettings();
      const updatedSettings = await SettingsService.updateSettings(currentSettings.id, body);

      return NextResponse.json({
        success: true,
        data: updatedSettings,
        message: 'Settings updated successfully'
      });
    }

  } catch (error) {
    console.error('Error updating settings:', error);
    
    // Handle validation errors specifically
    if (error instanceof Error && error.message.includes('Invalid main currency')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to update settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * Replace all settings (admin only — includes server-level sections)
 */
export async function PUT(request: NextRequest) {
  return withAdminAuth(request, () => replaceSettings(request));
}

async function replaceSettings(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { currency, priceData, display, notifications, version } = body;

    if (!currency || !priceData || !display || !notifications) {
      return NextResponse.json({
        success: false,
        error: 'Missing required settings categories'
      }, { status: 400 });
    }

    const currentSettings = await SettingsService.getSettings();
    const updatedSettings = await SettingsService.updateSettings(currentSettings.id, {
      currency,
      priceData,
      display,
      notifications,
      version: version || currentSettings.version
    });

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: 'All settings updated successfully'
    });

  } catch (error) {
    console.error('Error replacing settings:', error);
    
    // Handle validation errors specifically
    if (error instanceof Error && error.message.includes('Invalid main currency')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to replace settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 