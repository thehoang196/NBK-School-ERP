import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const databaseUrl = configService.get<string>('DATABASE_URL');

  // If DATABASE_URL is provided, use it directly (works cross-region on Render)
  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl,
      autoLoadEntities: true,
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      migrationsRun: isProduction,
      synchronize: false,
      logging: !isProduction,
      ssl: { rejectUnauthorized: false },
      extra: { ssl: { rejectUnauthorized: false } },
      retryAttempts: isProduction ? 10 : 3,
      retryDelay: 3000,
    };
  }

  const sslEnabled = configService.get<string>('DB_SSL', 'false') === 'true';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'postgres'),
    database: configService.get<string>('DB_DATABASE', 'stms'),
    autoLoadEntities: true,
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    migrationsRun: isProduction,
    synchronize: false,
    logging: !isProduction,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    extra: sslEnabled ? { ssl: { rejectUnauthorized: false } } : {},
    // Connection pool settings for production
    ...(isProduction && {
      poolSize: 10,
      connectTimeoutMS: 10000,
      maxQueryExecutionTime: 30000,
    }),
    // Retry connection on startup (useful for Render where DB may not be ready immediately)
    retryAttempts: isProduction ? 10 : 3,
    retryDelay: 3000,
  };
};
