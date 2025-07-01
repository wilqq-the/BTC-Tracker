import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/settings-service';
import { AppSettings } from '@/lib/types';

/**
 * GET /api/settings
 * Get current application settings
 */
export async function GET(): Promise<NextResponse> {
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
 * Create new settings (reset to defaults)
 */
export async function POST(): Promise<NextResponse> {
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
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Support both old category-based updates and new direct updates
    if (body.category && body.updates) {
      // Legacy category-based update
      const { category, updates } = body;

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
 * Replace all settings
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
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