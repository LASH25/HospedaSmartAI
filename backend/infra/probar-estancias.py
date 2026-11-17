"""Prueba local con datos nuevos; no borra registros ni muestra credenciales."""
import getpass
import json
import secrets
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from urllib.request import Request,urlopen
from urllib.error import HTTPError

def call(port,method,path,body=None,token=None,expected=200):
    headers={'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    req=Request(f'http://127.0.0.1:{port}{path}',method=method,headers=headers,data=None if body is None else json.dumps(body).encode())
    try:
        with urlopen(req,timeout=40) as r:status,content=r.status,r.read()
    except HTTPError as e:status,content=e.code,e.read()
    data=json.loads(content) if content else None
    if status!=expected:raise RuntimeError(f'{method} {path}: esperado {expected}, recibido {status}: {data}')
    return data

def main():
    password=getpass.getpass('Contraseña del administrador: ')
    admin=call(3004,'POST','/auth/login',{'email':'admin@hospedasmart.local','password':password})['access_token']
    del password
    tokens={}
    for rol in ['recepcionista','limpieza']:
        email=uuid.uuid4().hex+'@example.com';clave=secrets.token_urlsafe(24)
        call(3004,'POST','/usuarios',{'nombre':'Estancias '+rol,'email':email,'password':clave,'rol':rol},admin,201)
        tokens[rol]=call(3004,'POST','/auth/login',{'email':email,'password':clave})['access_token']
    recepcion,limpieza=tokens['recepcionista'],tokens['limpieza']
    room=call(3002,'POST','/habitaciones',{'numero':'E'+uuid.uuid4().hex[:9],'tipo':'doble','capacidad':2,'precio_noche':800},admin,201)
    guest=call(3003,'POST','/huespedes',{'nombre':'Huésped estancia de prueba','email':uuid.uuid4().hex+'@example.com','telefono':'9610000000'},recepcion,201)
    today=datetime.now(ZoneInfo('America/Mexico_City')).date()
    def reservar(start,end):
        return call(3001,'POST','/reservas',{'habitacion_id':room['id'],'huesped_id':guest['id'],'fecha_entrada':str(start),'fecha_salida':str(end)},recepcion,201)
    reserva=reservar(today,today+timedelta(days=2));path='/reservas/'+reserva['id'];roompath='/habitaciones/'+room['id']
    call(3001,'POST',path+'/check-in',{},expected=401)
    call(3001,'POST',path+'/check-in',{},limpieza,403)
    call(3002,'POST','/interno/habitaciones/'+room['id']+'/entrada',{'reserva_id':reserva['id']},admin,403)
    call(3001,'POST',path+'/check-out',{},recepcion,409)
    call(3002,'PATCH',roompath+'/estado',{'estado_operativo':'mantenimiento'},admin)
    call(3001,'POST',path+'/check-in',{},recepcion,409)
    assert call(3001,'GET',path+'/estancia',token=recepcion)['proceso']['fase']=='entrada_pendiente'
    call(3001,'PATCH',path+'/cancelar',token=recepcion,expected=409)
    call(3002,'PATCH',roompath+'/estado',{'estado_operativo':'disponible'},admin)
    def entrada(_):return call(3001,'POST',path+'/check-in',{},recepcion)
    with ThreadPoolExecutor(max_workers=2) as pool:
        entradas=list(pool.map(entrada,range(2)))
    assert all(x['reserva']['estado']=='en_estancia' for x in entradas)
    assert entradas[0]['proceso']['entrada_en']==entradas[1]['proceso']['entrada_en']
    assert call(3002,'GET',roompath+'/ocupacion',token=limpieza)['ocupada'] is True
    call(3002,'PATCH',roompath+'/estado',{'estado_operativo':'limpieza'},admin,409)
    call(3001,'PATCH',path+'/cancelar',token=recepcion,expected=409)
    cuenta=call(3006,'POST','/cuentas/abrir',{'reserva_id':reserva['id']},recepcion)
    account='/cuentas/'+cuenta['id']
    call(3006,'POST',account+'/consumos',{'concepto':'Servicio de prueba','cantidad':1,'precio_unitario':50},recepcion,201)
    call(3001,'POST',path+'/check-out',{},recepcion,409)
    assert call(3001,'GET',path+'/estancia',token=recepcion)['proceso']['fase']=='salida_pendiente'
    call(3001,'POST',path+'/check-in',{},recepcion,409)
    call(3006,'POST',account+'/pagos',{'clave_idempotencia':str(uuid.uuid4()),'monto':500,'metodo':'efectivo'},recepcion)
    call(3001,'POST',path+'/check-out',{},recepcion,409)
    assert call(3006,'GET',account+'/resumen',token=recepcion)['saldo']=='1150.00'
    call(3006,'POST',account+'/pagos',{'clave_idempotencia':str(uuid.uuid4()),'monto':1150,'metodo':'tarjeta'},recepcion)
    def salida(_):return call(3001,'POST',path+'/check-out',{},recepcion)
    with ThreadPoolExecutor(max_workers=2) as pool:
        salidas=list(pool.map(salida,range(2)))
    assert all(x['reserva']['estado']=='finalizada' for x in salidas)
    assert salidas[0]['proceso']['salida_en']==salidas[1]['proceso']['salida_en']
    assert call(3002,'GET',roompath+'/ocupacion',token=limpieza)['ocupada'] is False
    assert call(3002,'GET',roompath,token=recepcion)['estado_operativo']=='limpieza'
    resumen=call(3006,'GET',account+'/resumen',token=recepcion)
    assert resumen['saldo']=='0.00' and resumen['cuenta']['estado']=='cerrada'
    call(3002,'PATCH',roompath+'/estado',{'estado_operativo':'disponible'},limpieza)
    call(3001,'POST',path+'/check-out',{},recepcion)
    assert call(3002,'GET',roompath,token=recepcion)['estado_operativo']=='disponible'
    call(3001,'POST',path+'/check-in',{},recepcion,409)
    future=reservar(today+timedelta(days=7),today+timedelta(days=9))
    call(3001,'POST','/reservas/'+future['id']+'/check-in',{},recepcion,409)
    assert call(3001,'GET','/reservas/'+future['id']+'/estancia',token=recepcion)['proceso'] is None
    call(3001,'PATCH','/reservas/'+future['id']+'/cancelar',token=recepcion)
    call(3001,'POST','/reservas/'+future['id']+'/check-in',{},recepcion,409)
    print('OK: fechas del hotel, permisos, entrada pendiente recuperable, check-in concurrente, ocupación, cancelación bloqueada, saldo pendiente, liquidación, check-out concurrente, limpieza y reintentos sin repetir efectos.')
    print('Reserva:',reserva['id']);print('Cuenta:',cuenta['id'])
    print('Estado: finalizada; saldo: 0.00 MXN; habitación: disponible tras limpieza.')

if __name__=='__main__':main()
