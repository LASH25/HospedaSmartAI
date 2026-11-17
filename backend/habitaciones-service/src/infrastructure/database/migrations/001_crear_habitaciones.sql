BEGIN;

CREATE TABLE habitaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(10) NOT NULL UNIQUE,
    tipo VARCHAR(20) NOT NULL,
    capacidad INTEGER NOT NULL,
    precio_noche NUMERIC(10, 2) NOT NULL,
    estado_operativo VARCHAR(20) NOT NULL DEFAULT 'disponible',
    creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT numero_valido
        CHECK (length(trim(numero)) > 0),

    CONSTRAINT tipo_valido
        CHECK (tipo IN ('individual', 'doble', 'suite')),

    CONSTRAINT capacidad_valida
        CHECK (capacidad BETWEEN 1 AND 20),

    CONSTRAINT precio_valido
        CHECK (precio_noche >= 0),

    CONSTRAINT estado_operativo_valido
        CHECK (
            estado_operativo IN (
                'disponible',
                'limpieza',
                'mantenimiento'
            )
        )
);

INSERT INTO habitaciones (
    id,
    numero,
    tipo,
    capacidad,
    precio_noche
)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    '101',
    'doble',
    2,
    800.00
);

COMMIT;