-- Facturacion exclusiva del ambiente de pruebas.
USE hs_cobros;

CREATE TABLE IF NOT EXISTS `facturas` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cuenta_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ambiente` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'test',
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  `clave_idempotencia` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `proveedor_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uuid_fiscal` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total` decimal(12,2) NOT NULL,
  `moneda` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MXN',
  `solicitud` json NOT NULL,
  `creada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizada_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_factura_cuenta_ambiente` (`cuenta_id`,`ambiente`),
  UNIQUE KEY `uq_factura_idempotencia` (`clave_idempotencia`),
  UNIQUE KEY `uq_factura_proveedor` (`proveedor_id`),
  CONSTRAINT `fk_factura_cuenta` FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas` (`id`),
  CONSTRAINT `chk_factura_ambiente` CHECK ((`ambiente` = _utf8mb4'test')),
  CONSTRAINT `chk_factura_moneda` CHECK ((`moneda` = _utf8mb4'MXN')),
  CONSTRAINT `chk_factura_total` CHECK ((`total` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
