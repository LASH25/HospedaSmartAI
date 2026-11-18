import {
  Body, Controller, Get, HttpCode, Param,
  ParseUUIDPipe, Post, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FacturacionService } from '../facturacion.service';
import { EmitirFacturaDto } from './facturacion.dto';

@Controller('cuentas')
export class FacturacionController {
  constructor(private readonly facturacion: FacturacionService) {}

  @Post(':id/factura')
  @HttpCode(200)
  emitir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: EmitirFacturaDto,
  ) {
    return this.facturacion.emitir(id, datos);
  }

  @Get(':id/factura')
  consultar(@Param('id', ParseUUIDPipe) id: string) {
    return this.facturacion.consultar(id);
  }

  @Get(':id/factura/:formato')
  async descargar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('formato') formato: string,
    @Res() respuesta: Response,
  ) {
    const archivo = await this.facturacion.descargar(id, formato);
    respuesta.setHeader('Cache-Control', 'no-store');
    respuesta.setHeader(
      'Content-Type',
      formato === 'pdf' ? 'application/pdf' : 'application/xml',
    );
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename="factura-TEST-${id}.${formato}"`,
    );
    respuesta.send(archivo);
  }
}
