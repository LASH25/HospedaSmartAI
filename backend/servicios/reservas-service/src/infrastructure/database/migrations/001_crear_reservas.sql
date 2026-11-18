BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habitacion_id UUID NOT NULL,
    huesped_id UUID NOT NULL,
    fecha_entrada DATE NOT NULL,
    fecha_salida DATE NOT NULL,
    total NUMERIC(12, 2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'confirmada',
    creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fechas_validas
        CHECK (fecha_salida > fecha_entrada),

    CONSTRAINT total_valido
        CHECK (total >= 0),

    CONSTRAINT estado_valido
        CHECK (
            estado IN (
                'confirmada',
                'en_estancia',
                'finalizada',
                'cancelada'
            )
        ),

    CONSTRAINT evitar_reservas_cruzadas
        EXCLUDE USING gist (
            habitacion_id WITH =,
            daterange(fecha_entrada, fecha_salida, '[)') WITH &&
        )
        WHERE (estado IN ('confirmada', 'en_estancia'))
);

COMMIT;