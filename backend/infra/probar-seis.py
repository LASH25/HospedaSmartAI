"""Prueba local con datos nuevos. No borra datos; deja evidencias de prueba."""
import os
import json
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError

def request(port, method, route, body=None, expected=200):
    data = None if body is None else json.dumps(body).encode()
    req = Request(f'http://127.0.0.1:{port}{route}', data=data, method=method,
                  headers={'Content-Type': 'application/json', 'Authorization': 'Bearer '+os.environ.get('HOSPEDA_TOKEN','')})
    try:
        with urlopen(req, timeout=15) as r:
            status, payload = r.status, r.read()
    except HTTPError as e:
        status, payload = e.code, e.read()
    result = json.loads(payload) if payload else None
    if status != expected:
        raise RuntimeError(f'{method} {route}: esperado {expected}, recibido {status}: {result}')
    return result

def main():
    for port in range(3001,3007):
        request(port,'GET','/salud')
    for port, db in [(3003, 'hs_huespedes'), (3006, 'hs_cobros')]:
        health=request(port,'GET','/salud')
        if health.get('base_datos') != db:
            raise RuntimeError(f'Base incorrecta en puerto {port}: {health}')
    request(3003,'POST','/cuentas/abrir',{},404)
    request(3006,'GET','/huespedes',expected=404)
    suffix=uuid.uuid4().hex
    room=request(3002,'POST','/habitaciones',{'numero':'T'+suffix[:9], 'tipo':'doble','capacidad':2,'precio_noche':800},201)
    guest=request(3003,'POST','/huespedes',{'nombre':'Prueba integración','email':f'{suffix}@example.com','telefono':'9610000000'},201)
    data={'habitacion_id':room['id'],'huesped_id':guest['id'],'fecha_entrada':'2030-01-10','fecha_salida':'2030-01-12'}
    reservation=request(3001,'POST','/reservas',data,201)
    if float(reservation['total']) != 1600:
        raise RuntimeError('El total esperado es 1600 para dos noches.')
    request(3001,'POST','/reservas',data,409)
    request(3001,'POST','/reservas',{**data,'fecha_salida':'2030-01-09'},400)
    adjacent=request(3001,'POST','/reservas',{**data,'fecha_entrada':'2030-01-12','fecha_salida':'2030-01-13'},201)
    request(3002,'PATCH',f"/habitaciones/{room['id']}/estado",{'estado_operativo':'mantenimiento'})
    request(3001,'POST','/reservas',{**data,'fecha_entrada':'2030-01-14','fecha_salida':'2030-01-15'},409)
    request(3002,'PATCH',f"/habitaciones/{room['id']}/estado",{'estado_operativo':'disponible'})
    account=request(3006,'POST','/cuentas/abrir',{'reserva_id':reservation['id']})
    again=request(3006,'POST','/cuentas/abrir',{'reserva_id':reservation['id']})
    if account['id'] != again['id']:
        raise RuntimeError('La apertura repetida creó una cuenta distinta.')
    request(3001,'PATCH',f"/reservas/{adjacent['id']}/cancelar")
    answer=request(3005,'POST','/asistente/preguntar',{'pregunta':'horario salida check-out'},201)
    if answer.get('modo') != 'consulta_documental' or not answer.get('fuentes'):
        raise RuntimeError('No se encontró la fuente de demostración del asistente.')
    print('OK: salud, alta huésped/habitación, reserva, total, conflicto, fechas, periodos contiguos, mantenimiento, cuenta idempotente, cancelación y consulta documental.')
    print('Reserva de prueba:',reservation['id'])
    print('Cuenta de prueba:',account['id'])

if __name__=='__main__':
    main()
