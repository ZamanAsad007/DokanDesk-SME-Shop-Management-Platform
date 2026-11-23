import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { LoggerModule } from './common/logger/logger.module.js';

@Module({
  imports: [ConfigModule, LoggerModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
