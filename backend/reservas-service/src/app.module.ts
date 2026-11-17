import { SeguridadModule } from './infrastructure/security/seguridad.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SaludController } from './infrastructure/http/salud.controller';
import { ReservasModule } from './infrastructure/reservas.module';

@Module({
  imports: [
    SeguridadModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('DB_HOST'),
        port: Number(config.getOrThrow<string>('DB_PORT')),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        charset: 'utf8mb4',
        timezone: 'Z',
        synchronize: false,
      }),
    }),
    ReservasModule,
  ],
  controllers: [AppController, SaludController],
  providers: [AppService],
})
export class AppModule {}