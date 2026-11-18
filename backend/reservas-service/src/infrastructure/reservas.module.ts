import { AvisosEncuestaService } from "./avisos-encuesta.service";
import { EncuestasEstanciaController } from "./http/encuestas-estancia.controller";
import { LlavesController } from "./http/llaves.controller";
import { EncuestasController } from "./http/encuestas.controller";
import { MysqlEstanciasRepository } from './database/mysql-estancias.repository';
import { EstanciasController, CoordinadorEstancias } from './http/estancias.controller';
import { Module } from '@nestjs/common';
import { ServicioReservas } from '../application/servicio-reservas';
import { RESERVAS_REPOSITORY } from '../application/ports/reservas.repository';
import type { ReservasRepository } from '../application/ports/reservas.repository';
import { HABITACIONES_GATEWAY } from '../application/ports/habitaciones.gateway';
import type { HabitacionesGateway } from '../application/ports/habitaciones.gateway';
import { HUESPEDES_GATEWAY } from '../application/ports/huespedes.gateway';
import type { HuespedesGateway } from '../application/ports/huespedes.gateway';
import { MysqlReservasRepository } from './database/mysql-reservas.repository';
import { ReservasController } from './http/reservas.controller';
import { HttpHabitacionesGateway } from './http/clients/http-habitaciones.gateway';
import { HttpHuespedesGateway } from './http/clients/http-huespedes.gateway';

@Module({
  controllers: [ReservasController, EstanciasController, EncuestasController, LlavesController, EncuestasEstanciaController],
  providers: [
    AvisosEncuestaService,
    MysqlEstanciasRepository, CoordinadorEstancias,
    {
      provide: RESERVAS_REPOSITORY,
      useClass: MysqlReservasRepository,
    },
    {
      provide: HABITACIONES_GATEWAY,
      useClass: HttpHabitacionesGateway,
    },
    {
      provide: HUESPEDES_GATEWAY,
      useClass: HttpHuespedesGateway,
    },
    {
      provide: ServicioReservas,
      inject: [
        RESERVAS_REPOSITORY,
        HABITACIONES_GATEWAY,
        HUESPEDES_GATEWAY,
      ],
      useFactory: (
        repository: ReservasRepository,
        habitaciones: HabitacionesGateway,
        huespedes: HuespedesGateway,
      ) => new ServicioReservas(repository, habitaciones, huespedes),
    },
  ],
})
export class ReservasModule {}