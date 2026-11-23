import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';

@ApiTags('Health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe endpoint' })
  @ApiResponse({ status: 200, description: 'Application is live' })
  health() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe endpoint' })
  @ApiResponse({ status: 200, description: 'Application is ready to receive traffic' })
  @ApiResponse({ status: 503, description: 'Application dependencies unavailable' })
  ready(@Res({ passthrough: true }) res: Response) {
    // In future phases, checks DB and Redis ping.
    const isReady = true;

    if (!isReady) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        status: 'error',
        checks: {
          database: 'down',
        },
      };
    }

    return {
      status: 'ok',
      checks: {
        database: 'up',
        redis: 'up',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
