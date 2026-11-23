import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppLoggerService } from '../logger/logger.service.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly logger?: AppLoggerService) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    this.logger?.log('Connecting to PostgreSQL database via Prisma...', 'PrismaService');
    await this.$connect();
    this.logger?.log('Connected to PostgreSQL database successfully', 'PrismaService');
  }

  async onModuleDestroy() {
    this.logger?.log('Disconnecting from PostgreSQL database...', 'PrismaService');
    await this.$disconnect();
  }
}
