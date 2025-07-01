import { GET as getHealth } from '@/app/api/health/route';
import { GET as getDbHealth } from '@/app/api/health/db/route';
import { setupTestDatabase, cleanTestDatabase } from '../test-db';
import { AppInitializationService } from '@/lib/app-initialization';
import { prisma } from '@/lib/prisma';

// Mock the AppInitializationService
jest.mock('@/lib/app-initialization');

const mockAppInitializationService = AppInitializationService as jest.Mocked<typeof AppInitializationService>;

describe('Health API', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    jest.clearAllMocks();
    
    // Reset console.log and console.error to avoid test output pollution
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Ensure database connection is stable
    await prisma.$connect();
  });

  afterEach(async () => {
    await cleanTestDatabase();
    jest.restoreAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when app initialization succeeds', async () => {
      mockAppInitializationService.initialize.mockResolvedValue(undefined);

      const response = await getHealth();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.environment).toBeDefined();
      expect(mockAppInitializationService.initialize).toHaveBeenCalled();
    });

    it('should return version from environment variable when available', async () => {
      const originalVersion = process.env.npm_package_version;
      process.env.npm_package_version = '2.1.0';
      mockAppInitializationService.initialize.mockResolvedValue(undefined);

      const response = await getHealth();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.version).toBe('2.1.0');

      // Restore original value
      if (originalVersion) {
        process.env.npm_package_version = originalVersion;
      } else {
        delete process.env.npm_package_version;
      }
    });

    it('should return environment from NODE_ENV when available', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      mockAppInitializationService.initialize.mockResolvedValue(undefined);

      const response = await getHealth();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment).toBe('production');

      // Restore original value
      process.env.NODE_ENV = originalEnv;
    });

    it('should return unhealthy status when app initialization fails', async () => {
      mockAppInitializationService.initialize.mockRejectedValue(new Error('Initialization failed'));

      const response = await getHealth();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.timestamp).toBeDefined();
      expect(data.error).toBe('Health check failed');
    });

    it('should use default values when environment variables are not set', async () => {
      const originalVersion = process.env.npm_package_version;
      const originalEnv = process.env.NODE_ENV;
      
      delete process.env.npm_package_version;
      delete process.env.NODE_ENV;
      
      mockAppInitializationService.initialize.mockResolvedValue(undefined);

      const response = await getHealth();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.version).toBe('1.0.0');
      expect(data.environment).toBe('development');

      // Restore original values
      if (originalVersion) process.env.npm_package_version = originalVersion;
      if (originalEnv) process.env.NODE_ENV = originalEnv;
    });

    it('should include valid timestamp in ISO format', async () => {
      mockAppInitializationService.initialize.mockResolvedValue(undefined);

      const response = await getHealth();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(data.timestamp).getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
    });
  });

  describe('GET /api/health/db', () => {
    it('should return healthy database status when all checks pass', async () => {
      const response = await getDbHealth();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.database.connected).toBe(true);
      expect(typeof data.database.userCount).toBe('number');
      expect(typeof data.database.settingsCount).toBe('number');
      expect(data.database.settingsCount).toBeGreaterThanOrEqual(1); // At least the seeded settings
      expect(data.database.testQuery).toBeDefined();
      expect(Array.isArray(data.database.testQuery)).toBe(true);
    });

    it('should return correct counts for existing data', async () => {
      // Create test user and settings
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashed_password'
        }
      });

      await prisma.appSettings.create({
        data: {
          settingsData: JSON.stringify({ test: 'value' })
        }
      });

      const response = await getDbHealth();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.database.userCount).toBe(1);
      expect(data.database.settingsCount).toBe(2); // 1 from seed + 1 created here
    });

    it('should handle database connection errors gracefully', async () => {
      // Mock prisma to throw an error
      const originalQueryRaw = prisma.$queryRaw;
      jest.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('Database connection failed'));

      const response = await getDbHealth();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.timestamp).toBeDefined();
      expect(data.database.connected).toBe(false);
      expect(data.database.error).toBe('Database connection failed');

      // Restore the original method
      prisma.$queryRaw = originalQueryRaw;
    });

    it('should handle user count query errors gracefully', async () => {
      // Mock user count to throw an error
      const originalCount = prisma.user.count;
      jest.spyOn(prisma.user, 'count').mockRejectedValue(new Error('User table access denied'));

      const response = await getDbHealth();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.database.connected).toBe(false);
      expect(data.database.error).toBe('User table access denied');

      // Restore the original method
      prisma.user.count = originalCount;
    });

    it('should handle settings count query errors gracefully', async () => {
      // Mock settings count to throw an error
      const originalCount = prisma.appSettings.count;
      jest.spyOn(prisma.appSettings, 'count').mockRejectedValue(new Error('Settings table access denied'));

      const response = await getDbHealth();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.database.connected).toBe(false);
      expect(data.database.error).toBe('Settings table access denied');

      // Restore the original method
      prisma.appSettings.count = originalCount;
    });

    it('should include valid timestamp in ISO format', async () => {
      const response = await getDbHealth();
      const data = await response.json();

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(data.timestamp).getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
    });

    it('should return test query result in expected format', async () => {
      const response = await getDbHealth();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.database.testQuery).toBeDefined();
      expect(Array.isArray(data.database.testQuery)).toBe(true);
      if (data.database.testQuery.length > 0) {
        expect(data.database.testQuery[0]).toHaveProperty('test');
        expect(data.database.testQuery[0].test).toBe(1);
      }
    });

    it('should handle non-Error exceptions gracefully', async () => {
      // Mock prisma to throw a non-Error object
      const originalQueryRaw = prisma.$queryRaw;
      jest.spyOn(prisma, '$queryRaw').mockRejectedValue('String error');

      const response = await getDbHealth();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.database.connected).toBe(false);
      expect(data.database.error).toBe('Unknown database error');

      // Restore the original method
      prisma.$queryRaw = originalQueryRaw;
    });
  });

  describe('Health API integration', () => {
    it('should have consistent timestamp formats between endpoints', async () => {
      mockAppInitializationService.initialize.mockResolvedValue(undefined);

      const [healthResponse, dbHealthResponse] = await Promise.all([
        getHealth(),
        getDbHealth()
      ]);

      const healthData = await healthResponse.json();
      const dbHealthData = await dbHealthResponse.json();

      expect(healthData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(dbHealthData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Timestamps should be close to each other (within 1 second)
      const healthTime = new Date(healthData.timestamp).getTime();
      const dbHealthTime = new Date(dbHealthData.timestamp).getTime();
      expect(Math.abs(healthTime - dbHealthTime)).toBeLessThan(1000);
    });

    it('should both return healthy status when system is operational', async () => {
      mockAppInitializationService.initialize.mockResolvedValue(undefined);

      const [healthResponse, dbHealthResponse] = await Promise.all([
        getHealth(),
        getDbHealth()
      ]);

      const healthData = await healthResponse.json();
      const dbHealthData = await dbHealthResponse.json();

      expect(healthResponse.status).toBe(200);
      expect(dbHealthResponse.status).toBe(200);
      expect(healthData.status).toBe('healthy');
      expect(dbHealthData.status).toBe('healthy');
    });
  });
}); 