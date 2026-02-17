import { NextResponse } from 'next/server'

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring.
 * Returns service status and environment info.
 */
export async function GET() {
    return NextResponse.json({
        status: 'healthy',
        service: 'yieldprop-dashboard',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? '1.0.0',
        environment: process.env.NODE_ENV ?? 'development',
    })
}
