import { Module } from '@nestjs/common';
import { ServicioConocimientos } from '../application/servicio-conocimientos';
import { ServicioAsistente } from '../application/servicio-asistente';
import { CONOCIMIENTOS_REPOSITORY } from '../application/ports/conocimientos.repository';
import type { ConocimientosRepository } from '../application/ports/conocimientos.repository';
import { CONVERSACIONES_REPOSITORY } from '../application/ports/conversaciones.repository';
import type { ConversacionesRepository } from '../application/ports/conversaciones.repository';
import { MysqlConocimientosRepository } from './database/mysql-conocimientos.repository';
import { MysqlConversacionesRepository } from './database/mysql-conversaciones.repository';
import { ConocimientosController } from './http/conocimientos.controller';
import { AsistenteController } from './http/asistente.controller';

@Module({
  controllers: [
    ConocimientosController,
    AsistenteController,
  ],
  providers: [
    {
      provide: CONOCIMIENTOS_REPOSITORY,
      useClass: MysqlConocimientosRepository,
    },
    {
      provide: CONVERSACIONES_REPOSITORY,
      useClass: MysqlConversacionesRepository,
    },
    {
      provide: ServicioConocimientos,
      inject: [CONOCIMIENTOS_REPOSITORY],
      useFactory: (repository: ConocimientosRepository) =>
        new ServicioConocimientos(repository),
    },
    {
      provide: ServicioAsistente,
      inject: [
        ServicioConocimientos,
        CONVERSACIONES_REPOSITORY,
      ],
      useFactory: (
        conocimientos: ServicioConocimientos,
        conversaciones: ConversacionesRepository,
      ) => new ServicioAsistente(
        conocimientos,
        conversaciones,
      ),
    },
  ],
})
export class AsistenteModule {}