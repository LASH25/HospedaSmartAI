"""Prueba local de cobros. Crea datos de ejemplo y no borra registros."""
import os
import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
from urllib.error import HTTPError

def call(port, method, path, data=None, expected=200):
    req = Request(f'http://127.0.0.1:{port}{path}', method=method,
                  headers={'Content-Type':'application/json', 'Authorization':'Bearer '+os.environ.get('HOSPEDA_TOKEN','')},
                  data=None if data is None else json.dumps(data).encode())
    try:
        with urlopen(req, timeout=20) as r:
            status, content = r.status, r.read()
    except HTTPError as e:
        status, content = e.code, e.read()
    result = json.loads(content) if content else None
    if expected is not None and status != expected:
        raise RuntimeError(f'{method} {path}: esperado {expected}, recibido {status}: {result}')
    return (status, result) if expected is None else result

def main():
    suffix = uuid.uuid4().hex
    room = call(3002,'POST','/habitaciones',{'numero':'C'+suffix[:9],'tipo':'doble','capacidad':2,'precio_noche':800},201)
    guest = call(3003,'POST','/huespedes',{'nombre':'Prueba de cobros','email':suffix+'@example.com','telefono':'9610000000'},201)
    reserva = call(3001,'POST','/reservas',{'habitacion_id':room['id'],'huesped_id':guest['id'],'fecha_entrada':'2031-03-10','fecha_salida':'2031-03-12'},201)
    cuenta = call(3006,'POST','/cuentas/abrir',{'reserva_id':reserva['id']})
    path = '/cuentas/'+cuenta['id']
    assert call(3006,'GET',path+'/resumen')['saldo'] == '1600.00'
    call(3006,'POST',path+'/cerrar',{},409)
    consumo = {'concepto':'Desayuno','cantidad':2,'precio_unitario':75.50}
    added = call(3006,'POST',path+'/consumos',consumo,201)
    assert added['subtotal'] == '151.00'
    call(3006,'POST',path+'/consumos',{**consumo,'precio_unitario':1.001},400)
    call(3006,'POST',path+'/consumos',{**consumo,'concepto':'  '},400)
    pago = {'clave_idempotencia':str(uuid.uuid4()),'monto':500,'metodo':'efectivo'}
    first = call(3006,'POST',path+'/pagos',pago)
    again = call(3006,'POST',path+'/pagos',pago)
    assert first['id'] == again['id']
    call(3006,'POST',path+'/pagos',{**pago,'monto':501},409)
    call(3006,'POST',path+'/pagos',{**pago,'clave_idempotencia':str(uuid.uuid4()),'monto':2000},409)
    call(3006,'POST',path+'/pagos',{**pago,'monto':-1},400)
    resumen = call(3006,'GET',path+'/resumen')
    assert resumen['total'] == '1751.00' and resumen['saldo'] == '1251.00'
    assert len(resumen['pagos']) == 1
    # Dos pagos de 1000 contra saldo 1251: exactamente uno debe aceptarse.
    def concurrent_payment(_):
        return call(3006,'POST',path+'/pagos',{'clave_idempotencia':str(uuid.uuid4()),'monto':1000,'metodo':'tarjeta'},None)[0]
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(concurrent_payment,range(2)))
    assert sorted(statuses) == [200,409], statuses
    resumen = call(3006,'GET',path+'/resumen')
    assert resumen['saldo'] == '251.00'
    call(3006,'POST',path+'/pagos',{'clave_idempotencia':str(uuid.uuid4()),'monto':251,'metodo':'transferencia','referencia':'PRUEBA'})
    cerrado = call(3006,'POST',path+'/cerrar',{})
    assert cerrado['saldo']=='0.00' and cerrado['cuenta']['estado']=='cerrada'
    assert call(3006,'POST',path+'/cerrar',{})['cuenta']['estado']=='cerrada'
    call(3006,'POST',path+'/consumos',consumo,409)
    call(3006,'POST',path+'/pagos',{'clave_idempotencia':str(uuid.uuid4()),'monto':1,'metodo':'efectivo'},409)
    assert call(3006,'POST',path+'/pagos',pago)['id']==first['id']
    call(3006,'GET','/cuentas/'+str(uuid.uuid4())+'/resumen',expected=404)
    print('OK: consumos, decimales, abono, saldo, pago idempotente, conflicto de clave, sobrepago, concurrencia, liquidación, cierre y bloqueo de movimientos.')
    print('Cuenta de prueba:',cuenta['id'])
    print('Total: 1751.00 MXN; pagado: 1751.00 MXN; saldo: 0.00 MXN.')

if __name__ == '__main__':
    main()
