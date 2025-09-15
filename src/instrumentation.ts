/**
 * Next.js Instrumentation
 * This file is loaded once when the Next.js server starts
 * Used to initialize background services and schedulers
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[START] Next.js server starting - initializing BTC Tracker services...');
    
    // Dynamic import to avoid issues during build
    const { AppInitializationService } = await import('@/lib/app-initialization');
    
    // Initialize the application (starts scheduler, fetches initial data, etc.)
    try {
      await AppInitializationService.initialize();
      console.log('[OK] BTC Tracker services initialized successfully');
    } catch (error) {
      console.error('[ERROR] Failed to initialize BTC Tracker services:', error);
      // Don't throw - let the app continue running even if initialization fails
      // The services can be manually triggered later
    }
  }
}
