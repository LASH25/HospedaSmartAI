-- Estructuras auxiliares del sistema. Sin datos.

USE `hs_reservas`;

CREATE TABLE IF NOT EXISTS `bloqueos_habitaciones` (
  `habitacion_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`habitacion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `procesos_estancia` (
  `reserva_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fase` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entrada_en` timestamp NULL DEFAULT NULL,
  `salida_en` timestamp NULL DEFAULT NULL,
  `actualizada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`reserva_id`),
  CONSTRAINT `procesos_estancia_ibfk_1` FOREIGN KEY (`reserva_id`) REFERENCES `reservas` (`id`),
  CONSTRAINT `procesos_estancia_fase_valida` CHECK ((`fase` in (_utf8mb4'entrada_pendiente',_utf8mb4'en_estancia',_utf8mb4'salida_pendiente',_utf8mb4'finalizada')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `encuestas_reserva` (
  `reserva_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facilidad` tinyint unsigned NOT NULL,
  `claridad` tinyint unsigned NOT NULL,
  `satisfaccion` tinyint unsigned NOT NULL,
  `comentario` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `creada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reserva_id`),
  CONSTRAINT `chk_encuesta_claridad` CHECK ((`claridad` between 1 and 5)),
  CONSTRAINT `chk_encuesta_facilidad` CHECK ((`facilidad` between 1 and 5)),
  CONSTRAINT `chk_encuesta_satisfaccion` CHECK ((`satisfaccion` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `encuestas_estancia` (
  `reserva_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `atencion` tinyint unsigned NOT NULL,
  `limpieza` tinyint unsigned NOT NULL,
  `satisfaccion` tinyint unsigned NOT NULL,
  `comentario` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `creada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reserva_id`),
  CONSTRAINT `chk_estancia_atencion` CHECK ((`atencion` between 1 and 5)),
  CONSTRAINT `chk_estancia_limpieza` CHECK ((`limpieza` between 1 and 5)),
  CONSTRAINT `chk_estancia_satisfaccion` CHECK ((`satisfaccion` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `llaves_digitales` (
  `reserva_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `vence_en` datetime NOT NULL,
  `revocada_en` datetime DEFAULT NULL,
  `creada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`reserva_id`),
  UNIQUE KEY `uq_llave_token` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `avisos_encuesta` (
  `reserva_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  `intentos` int unsigned NOT NULL DEFAULT '0',
  `proximo_intento_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `bloqueo_hasta` datetime DEFAULT NULL,
  `bloqueo_token` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enviada_en` datetime DEFAULT NULL,
  `creada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`reserva_id`),
  KEY `idx_avisos_pendientes` (`estado`,`proximo_intento_en`),
  CONSTRAINT `chk_aviso_encuesta_estado` CHECK ((`estado` in (_utf8mb4'pendiente',_utf8mb4'procesando',_utf8mb4'enviada')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


USE `hs_habitaciones`;

CREATE TABLE IF NOT EXISTS `estancias_habitacion` (
  `reserva_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `habitacion_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entrada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `salida_en` timestamp NULL DEFAULT NULL,
  `habitacion_activa` char(36) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS ((case when (`estado` = _utf8mb4'en_estancia') then `habitacion_id` else NULL end)) STORED,
  PRIMARY KEY (`reserva_id`),
  UNIQUE KEY `una_estancia_activa_por_habitacion` (`habitacion_activa`),
  KEY `estancias_habitacion_buscar` (`habitacion_id`,`estado`),
  CONSTRAINT `estancias_habitacion_ibfk_1` FOREIGN KEY (`habitacion_id`) REFERENCES `habitaciones` (`id`),
  CONSTRAINT `estancias_habitacion_estado_valido` CHECK ((`estado` in (_utf8mb4'en_estancia',_utf8mb4'finalizada')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `solicitudes_habitacion` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reserva_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `habitacion_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `detalle` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `estado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  `creada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `atendida_por` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `completada_en` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_solicitud_reintento` (`reserva_id`,`id`),
  KEY `idx_solicitudes_estado` (`estado`,`creada_en`),
  KEY `idx_solicitudes_reserva` (`reserva_id`,`creada_en`),
  CONSTRAINT `chk_solicitud_estado` CHECK ((`estado` in (_utf8mb4'pendiente',_utf8mb4'en_atencion',_utf8mb4'completada'))),
  CONSTRAINT `chk_solicitud_tipo` CHECK ((`tipo` in (_utf8mb4'toallas',_utf8mb4'limpieza',_utf8mb4'mantenimiento')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


USE `hs_cobros`;

CREATE TABLE IF NOT EXISTS `intentos_mercadopago` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cuenta_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `moneda` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MXN',
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'creando',
  `preferencia_id` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enlace` text COLLATE utf8mb4_unicode_ci,
  `pago_externo_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pago_local_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mp_preferencia` (`preferencia_id`),
  UNIQUE KEY `uq_mp_pago_externo` (`pago_externo_id`),
  UNIQUE KEY `uq_mp_pago_local` (`pago_local_id`),
  KEY `idx_mp_cuenta` (`cuenta_id`),
  CONSTRAINT `fk_mp_cuenta` FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas` (`id`),
  CONSTRAINT `chk_mp_moneda` CHECK ((`moneda` = _utf8mb4'MXN')),
  CONSTRAINT `chk_mp_monto` CHECK ((`monto` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

