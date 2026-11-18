from pathlib import Path
import subprocess
import time
import uuid

raiz = Path(__file__).resolve().parent
nombre = "hospeda-prueba-sql-" + uuid.uuid4().hex[:10]
creado = False

def ejecutar(args, **opciones):
    return subprocess.run(
        args, check=True, capture_output=True, text=True, **opciones
    ).stdout.strip()

try:
    candidatos = ejecutar([
        "docker", "ps", "-q",
        "--filter", "label=com.docker.compose.service=mysql-stack",
    ]).splitlines()
    if len(candidatos) != 1:
        raise RuntimeError("Se esperaba un único contenedor mysql-stack activo.")

    imagen = ejecutar([
        "docker", "inspect", "--format", "{{.Image}}", candidatos[0],
    ])

    ejecutar([
        "docker", "create", "--name", nombre,
        "--network", "none",
        "--tmpfs", "/var/lib/mysql:rw",
        "--env", "MYSQL_ALLOW_EMPTY_PASSWORD=yes",
        imagen,
    ])
    creado = True
    ejecutar(["docker", "start", nombre])

    listo = False
    for _ in range(80):
        proceso = subprocess.run(
            ["docker", "exec", nombre, "cat", "/proc/1/comm"],
            capture_output=True, text=True,
        )
        if proceso.stdout.strip() == "mysqld":
            prueba = subprocess.run(
                ["docker", "exec", nombre, "mysql",
                 "-uroot", "-N", "-e", "SELECT 1"],
                capture_output=True, text=True,
            )
            if prueba.returncode == 0:
                listo = True
                break
        time.sleep(0.75)
    if not listo:
        raise RuntimeError("MySQL temporal no estuvo listo en un minuto.")

    for archivo in [
        "001-inicializar.sql",
        "002-estancias-servicios-pagos.sql",
        "002-estancias-servicios-pagos.sql",
        "003-facturacion-test.sql",
        "003-facturacion-test.sql",
    ]:
        ejecutar(
            ["docker", "exec", "-i", nombre, "mysql",
             "-uroot", "--default-character-set=utf8mb4"],
            input=(raiz / "mysql" / archivo).read_text(),
        )
        print("SQL ejecutado:", archivo)

    sql = """
    SELECT table_schema, COUNT(*)
    FROM information_schema.tables
    WHERE table_schema IN (
      'hs_habitaciones','hs_huespedes','hs_reservas',
      'hs_cobros','hs_usuarios','hs_asistente'
    ) AND table_type = 'BASE TABLE'
    GROUP BY table_schema;
    """
    salida = ejecutar([
        "docker", "exec", nombre, "mysql", "-uroot", "-N", "-e", sql,
    ])
    obtenidas = dict(
        (base, int(cantidad))
        for base, cantidad in (fila.split() for fila in salida.splitlines())
    )
    esperadas = {
        "hs_habitaciones": 3,
        "hs_huespedes": 1,
        "hs_reservas": 7,
        "hs_cobros": 5,
        "hs_usuarios": 1,
        "hs_asistente": 3,
    }
    if obtenidas != esperadas:
        raise RuntimeError("El número de tablas no coincide: " + str(obtenidas))

    print(salida)
    print("PRUEBA SUPERADA: instalación nueva y repetición de 002 y 003 correctas.")
except subprocess.CalledProcessError as error:
    print("PRUEBA NO SUPERADA:", error.stderr.strip())
    raise SystemExit(1)
except Exception as error:
    print("PRUEBA NO SUPERADA:", str(error))
    raise SystemExit(1)
finally:
    if creado:
        subprocess.run(
            ["docker", "rm", "-f", "-v", nombre],
            check=True, stdout=subprocess.DEVNULL,
        )
        print("Contenedor temporal eliminado.")
