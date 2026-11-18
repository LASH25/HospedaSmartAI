from pathlib import Path
import secrets
import os
root = Path(__file__).resolve().parents[2]
file = root/'seguridad.env'
try:
    with file.open('x') as f:
        os.chmod(file,0o600)
        f.write('RESERVAS_INTERNAL_TOKEN='+secrets.token_hex(32)+'\n')
        f.write('COBROS_INTERNAL_TOKEN='+secrets.token_hex(32)+'\n')
    print('OK: seguridad.env creado; conserva este archivo privado.')
except FileExistsError:
    print('seguridad.env ya existe; se conservó sin cambios.')
