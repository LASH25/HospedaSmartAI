import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PermisosGuard } from './permisos.guard';
@Module({ providers: [{ provide: APP_GUARD, useClass: PermisosGuard }] })
export class SeguridadModule {}
