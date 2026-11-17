import { Module } from '@nestjs/common';
import { ServicioHuespedes } from '../application/servicio-huespedes';
import { HUESPEDES_REPOSITORY } from '../application/ports/huespedes.repository';
import type { HuespedesRepository } from '../application/ports/huespedes.repository';
import { MysqlHuespedesRepository } from './database/mysql-huespedes.repository';
import { HuespedesController } from './http/huespedes.controller';

@Module({
  controllers: [HuespedesController],
  providers: [
    {
      provide: HUESPEDES_REPOSITORY,
      useClass: MysqlHuespedesRepository,
    },
    {
      provide: ServicioHuespedes,
      inject: [HUESPEDES_REPOSITORY],
      useFactory: (repository: HuespedesRepository) =>
        new ServicioHuespedes(repository),
    },
  ],
  exports: [HUESPEDES_REPOSITORY],
})
export class HuespedesModule {}