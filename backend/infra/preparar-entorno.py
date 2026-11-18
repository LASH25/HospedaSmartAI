"""Genera secretos locales sin tocar los .env anteriores. Python 3 estándar."""
import os
import secrets
from pathlib import Path
root = Path(__file__).resolve().parents[2]
path = root / 'stack.env'
try:
    with path.open('x') as f:
        os.chmod(path, 0o600)
        f.write('STACK_DB_PASSWORD=' + secrets.token_hex(24) + '\n')
        f.write('STACK_JWT_SECRET=' + secrets.token_hex(48) + '\n')
    print('stack.env creado. No lo compartas ni lo subas a Git.')
except FileExistsError:
    print('stack.env ya existe. Se conservó sin modificaciones.')
