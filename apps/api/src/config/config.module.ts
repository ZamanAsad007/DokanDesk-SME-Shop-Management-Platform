import { Global, Module } from '@nestjs/common';
import { env, EnvConfig } from './env.js';

export const ENV_TOKEN = 'ENV_CONFIG';

@Global()
@Module({
  providers: [
    {
      provide: ENV_TOKEN,
      useValue: env,
    },
  ],
  exports: [ENV_TOKEN],
})
export class ConfigModule {}
