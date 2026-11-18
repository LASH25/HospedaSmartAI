import { FacturacionController } from "./http/facturacion.controller";
import { FacturacionService } from "./facturacion.service";
import { MercadoPagoController } from "./http/mercadopago.controller";
import { EstanciasCobrosController } from './http/estancias-internas.controller';
import { MysqlMovimientosRepository } from './database/mysql-movimientos.repository';
import { MovimientosController } from './http/movimientos.controller';
import { Module } from '@nestjs/common';
import { ServicioCuentas } from '../application/servicio-cuentas';
import { CUENTAS_REPOSITORY } from '../application/ports/cuentas.repository';
import type { CuentasRepository } from '../application/ports/cuentas.repository';
import { RESERVAS_GATEWAY } from '../application/ports/reservas.gateway';
import type { ReservasGateway } from '../application/ports/reservas.gateway';
import { HUESPEDES_GATEWAY } from '../application/ports/huespedes.gateway';
import type { HuespedesGateway } from '../application/ports/huespedes.gateway';
import { MysqlCuentasRepository } from './database/mysql-cuentas.repository';
import { HttpReservasGateway } from './http/clients/http-reservas.gateway';
import { CuentasController } from './http/cuentas.controller';
import { HttpHuespedesGateway } from './http/clients/http-huespedes.gateway';

@Module({
  controllers: [FacturacionController, MercadoPagoController, CuentasController, MovimientosController, EstanciasCobrosController],
  providers: [FacturacionService,
    MysqlMovimientosRepository,
    { provide: HUESPEDES_GATEWAY, useClass: HttpHuespedesGateway },
    {
      provide: CUENTAS_REPOSITORY,
      useClass: MysqlCuentasRepository,
    },
    {
      provide: RESERVAS_GATEWAY,
      useClass: HttpReservasGateway,
    },
    {
      provide: ServicioCuentas,
      inject: [
        CUENTAS_REPOSITORY,
        RESERVAS_GATEWAY,
        HUESPEDES_GATEWAY,
      ],
      useFactory: (
        repository: CuentasRepository,
        reservas: ReservasGateway,
        huespedes: HuespedesGateway,
      ) => new ServicioCuentas(repository, reservas, huespedes),
    },
  ],
})
export class CuentasModule {}
