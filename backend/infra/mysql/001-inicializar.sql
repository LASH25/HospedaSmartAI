-- Solo se ejecuta automáticamente en el volumen NUEVO de compose.stack.yaml.
CREATE DATABASE hs_habitaciones CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE hs_huespedes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE hs_reservas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE hs_cobros CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE hs_usuarios CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE hs_asistente CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE hs_habitaciones;
CREATE TABLE habitaciones (
 id CHAR(36) PRIMARY KEY, numero VARCHAR(10) NOT NULL UNIQUE,
 tipo VARCHAR(20) NOT NULL, capacidad INT NOT NULL,
 precio_noche DECIMAL(10,2) NOT NULL,
 estado_operativo VARCHAR(20) NOT NULL DEFAULT 'disponible',
 creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (CHAR_LENGTH(TRIM(numero)) > 0),
 CHECK (tipo IN ('individual','doble','suite')),
 CHECK (capacidad BETWEEN 1 AND 20), CHECK (precio_noche >= 0),
 CHECK (estado_operativo IN ('disponible','limpieza','mantenimiento'))
) ENGINE=InnoDB;
INSERT INTO habitaciones(id,numero,tipo,capacidad,precio_noche) VALUES
 ('11111111-1111-4111-8111-111111111111','101','doble',2,800.00);

USE hs_huespedes;
CREATE TABLE huespedes (
 id CHAR(36) PRIMARY KEY, nombre VARCHAR(100) NOT NULL,
 email VARCHAR(150) NOT NULL UNIQUE, telefono VARCHAR(20) NOT NULL,
 creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (CHAR_LENGTH(TRIM(nombre)) BETWEEN 2 AND 100),
 CHECK (CHAR_LENGTH(TRIM(telefono)) BETWEEN 7 AND 20)
) ENGINE=InnoDB;
INSERT INTO huespedes(id,nombre,email,telefono) VALUES
 ('22222222-2222-4222-8222-222222222222','Huésped de prueba','huesped@example.com','9610000000');

USE hs_reservas;
CREATE TABLE bloqueos_habitaciones (habitacion_id CHAR(36) PRIMARY KEY) ENGINE=InnoDB;
CREATE TABLE reservas (
 id CHAR(36) PRIMARY KEY, habitacion_id CHAR(36) NOT NULL,
 huesped_id CHAR(36) NOT NULL, fecha_entrada DATE NOT NULL, fecha_salida DATE NOT NULL,
 total DECIMAL(12,2) NOT NULL, estado VARCHAR(20) NOT NULL DEFAULT 'confirmada',
 creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (fecha_salida > fecha_entrada), CHECK (total >= 0),
 CHECK (estado IN ('confirmada','en_estancia','finalizada','cancelada')),
 INDEX disponibilidad_idx (habitacion_id,estado,fecha_entrada,fecha_salida)
) ENGINE=InnoDB;

USE hs_cobros;
CREATE TABLE cuentas (
 id CHAR(36) PRIMARY KEY, reserva_id CHAR(36) NOT NULL UNIQUE,
 huesped_id CHAR(36) NOT NULL, total_estancia DECIMAL(12,2) NOT NULL,
 moneda VARCHAR(3) NOT NULL DEFAULT 'MXN', estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
 creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (total_estancia >= 0), CHECK (moneda='MXN'), CHECK (estado IN ('abierta','cerrada'))
) ENGINE=InnoDB;
-- Consumos y pagos de las cuentas de estancia.
CREATE TABLE consumos (
 id CHAR(36) PRIMARY KEY, cuenta_id CHAR(36) NOT NULL, concepto VARCHAR(150) NOT NULL,
 cantidad INT NOT NULL, precio_unitario DECIMAL(12,2) NOT NULL,
 subtotal DECIMAL(16,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
 creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(cuenta_id) REFERENCES cuentas(id),
 CHECK (CHAR_LENGTH(TRIM(concepto)) BETWEEN 2 AND 150),
 CHECK (cantidad BETWEEN 1 AND 1000), CHECK (precio_unitario >= 0)
) ENGINE=InnoDB;
CREATE TABLE pagos (
 id CHAR(36) PRIMARY KEY, cuenta_id CHAR(36) NOT NULL,
 clave_idempotencia CHAR(36) NOT NULL UNIQUE, monto DECIMAL(12,2) NOT NULL,
 metodo VARCHAR(20) NOT NULL, referencia VARCHAR(100),
 creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(cuenta_id) REFERENCES cuentas(id), CHECK (monto > 0),
 CHECK (metodo IN ('efectivo','tarjeta','transferencia'))
) ENGINE=InnoDB;

USE hs_usuarios;
CREATE TABLE usuarios (
 id CHAR(36) PRIMARY KEY, nombre VARCHAR(100) NOT NULL,
 email VARCHAR(150) NOT NULL UNIQUE, password_hash VARCHAR(512) NOT NULL,
 rol VARCHAR(20) NOT NULL, activo BOOLEAN NOT NULL DEFAULT TRUE,
 creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (rol IN ('administrador','recepcionista','limpieza'))
) ENGINE=InnoDB;

USE hs_asistente;
CREATE TABLE conocimientos (
 id CHAR(36) PRIMARY KEY, titulo VARCHAR(200) NOT NULL, categoria VARCHAR(100) NOT NULL,
 contenido TEXT NOT NULL, activo BOOLEAN NOT NULL DEFAULT TRUE,
 FULLTEXT INDEX buscar_conocimientos (titulo,contenido)
) ENGINE=InnoDB;
CREATE TABLE conversaciones (
 id CHAR(36) PRIMARY KEY, canal VARCHAR(30) NOT NULL,
 creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE mensajes (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, conversacion_id CHAR(36) NOT NULL,
 rol VARCHAR(20) NOT NULL, contenido TEXT NOT NULL,
 creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(conversacion_id) REFERENCES conversaciones(id),
 CHECK (rol IN ('usuario','asistente'))
) ENGINE=InnoDB;
INSERT INTO conocimientos(id,titulo,categoria,contenido) VALUES
 ('33333333-3333-4333-8333-333333333333','Horario de salida — demostración','horarios',
 'El check-out de demostración es a las 12:00 horas. Confirma el horario real con recepción.');
