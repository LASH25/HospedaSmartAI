"""Solicita contraseña por terminal; no muestra tokens ni contraseñas."""
import getpass
import json
import os
import secrets
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError

def call(port,method,path,body=None,token=None,expected=200):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    req=Request(f'http://127.0.0.1:{port}{path}',method=method,headers=headers,
                data=None if body is None else json.dumps(body).encode())
    try:
        with urlopen(req,timeout=20) as r:status,content=r.status,r.read()
    except HTTPError as e:status,content=e.code,e.read()
    data=json.loads(content) if content else None
    if status!=expected:raise RuntimeError(f'{method} {path}: esperado {expected}, recibido {status}.')
    return data

def login(email,password):
    return call(3004,'POST','/auth/login',{'email':email,'password':password})['access_token']

def main():
    password=getpass.getpass('Contraseña del administrador: ')
    admin=login('admin@hospedasmart.local',password)
    del password
    for port in range(3001,3007):call(port,'GET','/salud')
    for port,path in [(3001,'/reservas'),(3002,'/habitaciones'),(3003,'/huespedes'),(3004,'/usuarios'),(3005,'/conocimientos/buscar?pregunta=salida'),(3006,'/cuentas/'+str(uuid.uuid4())+'/resumen')]:
        call(port,'GET',path,expected=401)
        call(port,'GET',path,token='token-falso',expected=401)
    tokens={}
    for rol in ['recepcionista','limpieza']:
        email=rol+'-'+uuid.uuid4().hex+'@example.com';clave=secrets.token_urlsafe(24)
        user=call(3004,'POST','/usuarios',{'nombre':'Prueba '+rol,'email':email,'password':clave,'rol':rol},admin,201)
        assert 'password_hash' not in user and 'password' not in user
        tokens[rol]=login(email,clave)
    users=call(3004,'GET','/usuarios',token=admin)
    assert all('password_hash' not in u for u in users)
    for token in tokens.values():
        call(3004,'GET','/usuarios',token=token,expected=403)
        call(3004,'POST','/usuarios',{},token,403)
    reception,clean=tokens['recepcionista'],tokens['limpieza']
    call(3003,'GET','/huespedes',token=reception)
    call(3003,'GET','/huespedes',token=clean,expected=403)
    call(3001,'GET','/reservas',token=clean,expected=403)
    call(3006,'GET','/cuentas/'+str(uuid.uuid4())+'/resumen',token=clean,expected=403)
    room_data={'numero':'S'+uuid.uuid4().hex[:9],'tipo':'doble','capacidad':2,'precio_noche':800}
    call(3002,'POST','/habitaciones',room_data,reception,403)
    call(3002,'POST','/habitaciones',room_data,clean,403)
    room=call(3002,'POST','/habitaciones',room_data,admin,201)
    path='/habitaciones/'+room['id']+'/estado'
    call(3002,'GET','/habitaciones',token=clean)
    call(3002,'PATCH',path,{'estado_operativo':'limpieza'},clean)
    call(3002,'PATCH',path,{'estado_operativo':'disponible'},clean)
    call(3002,'PATCH',path,{'estado_operativo':'mantenimiento'},clean,403)
    call(3002,'PATCH',path,{'estado_operativo':'mantenimiento'},admin)
    call(3002,'PATCH',path,{'estado_operativo':'disponible'},clean,403)
    call(3002,'PATCH',path,{'estado_operativo':'disponible'},admin)
    call(3005,'GET','/conocimientos/buscar?pregunta=salida',token=clean)
    print('OK: JWT, rechazo sin sesión/token falso, administración de usuarios, permisos de recepción y limpieza, y mantenimiento protegido.',flush=True)
    env=os.environ.copy();env['HOSPEDA_TOKEN']=admin
    folder=Path(__file__).resolve().parent
    for script in ['probar-seis.py','probar-cobros.py']:
        subprocess.run([sys.executable,str(folder/script)],env=env,check=True)
    subprocess.run(['docker','compose','--env-file','stack.env','--env-file','seguridad.env','-f','compose.estancias.yaml','exec','-T','reservas-service','node'],input=(folder/'probar-internos.cjs').read_text(),text=True,check=True)
    # Recepción puede ejecutar los movimientos existentes, pero no crear habitaciones.
    resumen=call(3006,'GET','/cuentas/'+str(uuid.uuid4())+'/resumen',token=reception,expected=404)
    print('OK: integración de seis servicios y cobros con autenticación.',flush=True)

if __name__=='__main__':main()
