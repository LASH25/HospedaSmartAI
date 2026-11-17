import {ServicioHuespedes} from './servicio-huespedes';
import {HuespedInvalido,HuespedNoEncontrado} from '../domain/huesped';
import type {HuespedesRepository} from './ports/huespedes.repository';
const guest={id:'id1',nombre:'Laura',email:'laura@example.com',telefono:'5551234567',creada_en:new Date()};
function setup(){const actualizarContacto=jest.fn().mockResolvedValue(guest);const repo: HuespedesRepository={crear:jest.fn(),listar:jest.fn(),buscarPorId:jest.fn(),actualizarContacto};return{servicio:new ServicioHuespedes(repo),actualizarContacto}}
describe('actualizar contacto',()=>{
 it('normaliza y solo envía nombre y teléfono al repositorio',async()=>{const t=setup();await t.servicio.actualizarContacto('id1',{nombre:'  Laura   Nueva  ',telefono:' 5559999999 '});expect(t.actualizarContacto).toHaveBeenCalledWith('id1',{nombre:'Laura Nueva',telefono:'5559999999'})});
 it('rechaza datos inválidos antes de escribir',async()=>{const t=setup();await expect(t.servicio.actualizarContacto('id1',{nombre:'A',telefono:'xxx'})).rejects.toBeInstanceOf(HuespedInvalido);expect(t.actualizarContacto).not.toHaveBeenCalled()});
 it('rechaza huésped inexistente',async()=>{const t=setup();t.actualizarContacto.mockResolvedValue(null);await expect(t.servicio.actualizarContacto('missing',{nombre:'Laura',telefono:'5551234567'})).rejects.toBeInstanceOf(HuespedNoEncontrado)});
});
