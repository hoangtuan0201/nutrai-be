import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('database.url');
    if (!connectionString) {
      throw new Error('Database URL is not defined in the configuration');
    }

    // Set up PG Connection Pool
    const pool = new Pool({ connectionString });
    
    // Initialize Prisma Pg Driver Adapter
    const adapter = new PrismaPg(pool);

    // Call PrismaClient constructor with the driver adapter
    super({ adapter });
    
    this.pool = pool;
  }

  async onModuleInit() {
    // Connect to the database
    await this.$connect();
  }

  async onModuleDestroy() {
    // Disconnect and clean up pool connections
    await this.$disconnect();
    await this.pool.end();
  }
}
