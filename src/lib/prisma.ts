import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaShutdownHandlersSetup?: boolean
}

// Enhanced Prisma configuration for better I/O performance
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Only set up graceful shutdown handlers during actual runtime, not during build
const isBuildTime = () => {
  return process.env.NEXT_PHASE === 'phase-production-build' || 
         process.env.CI || 
         process.env.BUILD_MODE ||
         process.argv.some(arg => arg.includes('next build') || arg.includes('npm run build'))
}

if (!isBuildTime()) {
  // Add graceful shutdown handling only during runtime
  // Use global flag to prevent duplicate handlers during hot-reload
  const setupShutdownHandlers = () => {
    if (globalForPrisma.prismaShutdownHandlersSetup) return
    globalForPrisma.prismaShutdownHandlersSetup = true
    
    process.on('beforeExit', async () => {
      console.log('Disconnecting from database...')
      await prisma.$disconnect()
    })

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, disconnecting from database...')
      await prisma.$disconnect()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, disconnecting from database...')
      await prisma.$disconnect()
      process.exit(0)
    })
  }
  
  // Set up handlers on first use
  setupShutdownHandlers()
} 