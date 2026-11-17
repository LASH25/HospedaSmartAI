import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { ClavesService } from '../../application/ports/claves.service';

@Injectable()
export class ScryptClavesService implements ClavesService {
  private derivar(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        64,
        {
          N: 131072,
          r: 8,
          p: 1,
          maxmem: 256 * 1024 * 1024,
        },
        (error, clave) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(clave);
        },
      );
    });
  }

  async generar(password: string): Promise<string> {
    const salt = randomBytes(16);
    const clave = await this.derivar(password, salt);

    return [
      'scrypt',
      salt.toString('hex'),
      clave.toString('hex'),
    ].join('$');
  }

  async verificar(password: string, hash: string): Promise<boolean> {
    const formatoValido =
      /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash);

    const valor = formatoValido
      ? hash
      : ['scrypt', '00'.repeat(16), '00'.repeat(64)].join('$');

    const partes = valor.split('$');
    const salt = Buffer.from(partes[1], 'hex');
    const esperada = Buffer.from(partes[2], 'hex');
    const calculada = await this.derivar(password, salt);

    const coincide = timingSafeEqual(calculada, esperada);

    return formatoValido && coincide;
  }
}