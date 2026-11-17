import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MysqlUsuariosRepository } from './infrastructure/database/mysql-usuarios.repository';
import { ScryptClavesService } from './infrastructure/security/scrypt-claves.service';

async function crearAdmin() {
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 12 || password.length > 128) {
    throw new Error(
      'La contraseña debe tener entre 12 y 128 caracteres.',
    );
  }

  const app = await NestFactory.createApplicationContext(
    AppModule,
    { logger: ['error', 'warn'] },
  );

  try {
    const usuarios = app.get(MysqlUsuariosRepository);
    const claves = app.get(ScryptClavesService);
    const email = 'admin@hospedasmart.local';

    const existente = await usuarios.buscarPorEmail(email);

    if (existente) {
      console.log(
        'Ese correo ya está registrado. No se modificó su cuenta.',
      );
      return;
    }

    const usuario = await usuarios.crear({
      nombre: 'Administrador HospedaSmart',
      email,
      password_hash: await claves.generar(password),
      rol: 'administrador',
    });

    console.log('Administrador creado correctamente.');
    console.log(`Correo: ${usuario.email}`);
    console.log(`Rol: ${usuario.rol}`);
  } finally {
    await app.close();
  }
}

crearAdmin().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'No fue posible crear el administrador.',
  );

  process.exitCode = 1;
});