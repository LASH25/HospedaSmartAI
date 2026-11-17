import { OcupacionesRepository, OcupacionesController, OcupacionesInternasController } from './http/ocupaciones.controller';
import { Module } from '@nestjs/common';
import { ServicioHabitaciones } from '../application/servicio-habitaciones';
import { HABITACIONES_REPOSITORY } from '../application/ports/habitaciones.repository';
import type { HabitacionesRepository } from '../application/ports/habitaciones.repository';
import { MysqlHabitacionesRepository } from './database/mysql-habitaciones.repository';
import { HabitacionesController } from './http/habitaciones.controller';

@Module({
  controllers: [HabitacionesController, OcupacionesController, OcupacionesInternasController],
  providers: [
    OcupacionesRepository,
    {
      provide: HABITACIONES_REPOSITORY,
      useClass: MysqlHabitacionesRepository,
    },
    {
      provide: ServicioHabitaciones,
      inject: [HABITACIONES_REPOSITORY],
      useFactory: (repository: HabitacionesRepository) =>
        new ServicioHabitaciones(repository),
    },
  ],
})
export class HabitacionesModule {}