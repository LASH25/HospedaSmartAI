import {randomBytes,randomInt,createHmac,timingSafeEqual} from 'node:crypto';
export class AccesoError extends Error { constructor(status,message){super(message);this.status=status;} }
export function crearAcceso({enviar,limitar,ahora=Date.now}){
 const retos=new Map(),sesiones=new Map(),secret=randomBytes(32);
 const hash=s=>createHmac('sha256',secret).update(s).digest();
 const iguales=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
 const limpiar=()=>{for(const m of [retos,sesiones])for(const[k,v]of m)if(v.vence<=ahora())m.delete(k)};
 async function solicitar(b,ip){
  const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  if(email.length>150||!/^\S+@\S+\.\S+$/.test(email)||b.sitio_web)throw new AccesoError(400,'Revisa el correo.');
  limitar(`acceso-ip:${ip}`,10,3600000);limitar(`acceso-email:${email}`,5,3600000);limitar(`acceso-espera:${email}`,1,60000);limitar('correo-global',200,3600000);
  limpiar();if(retos.size>=2000)throw new AccesoError(503,'Intenta más tarde.');
  for(const[k,v]of retos)if(v.email===email)retos.delete(k);
  const id=randomBytes(24).toString('hex'),codigo=String(randomInt(1000000)).padStart(6,'0');
  retos.set(id,{email,digest:hash(id+codigo),intentos:0,vence:ahora()+600000,listo:false});
  try{await enviar(email,codigo)}catch{retos.delete(id);throw new AccesoError(503,'No pudimos enviar el código. Espera un minuto e intenta de nuevo.')}
  const reto=retos.get(id);if(!reto)throw new AccesoError(400,'Solicita un nuevo código.');reto.listo=true;
  return{acceso_id:id,vence_en:600,reenviar_en:60,mensaje:'Revisa tu correo y spam para continuar.'};
 }
 function confirmar(b,ip){
  limitar(`acceso-verificar:${ip}`,30,3600000);limpiar();
  const r=retos.get(b.acceso_id);if(!r||!r.listo)throw new AccesoError(400,'Código inválido o vencido.');
  r.intentos++;
  const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  if(r.intentos>5||typeof b.codigo!=='string'||!/^\d{6}$/.test(b.codigo)||email!==r.email||!timingSafeEqual(r.digest,hash(b.acceso_id+b.codigo))){if(r.intentos>=5)retos.delete(b.acceso_id);throw new AccesoError(400,'Código inválido o vencido.');}
  retos.delete(b.acceso_id);const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex'),vence=ahora()+1800000;
  sesiones.set(hash(token).toString('hex'),{email:r.email,csrf,vence});return{token,csrf,vence,email:r.email};
 }
 function leer(cookie,csrf){
  limpiar();const token=String(cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('hs_estancia='))?.slice(12);
  if(!token||!/^[a-f0-9]{64}$/.test(token))throw new AccesoError(401,'Tu sesión venció. Ingresa de nuevo.');
  const key=hash(token).toString('hex'),session=sesiones.get(key);if(!session)throw new AccesoError(401,'Tu sesión venció. Ingresa de nuevo.');
  if(csrf!==undefined&&!iguales(session.csrf,csrf))throw new AccesoError(403,'No se pudo validar la solicitud. Recarga Mi estancia.');
  return{...session,key};
 }
 function cerrar(key){sesiones.delete(key)}
 return{solicitar,confirmar,leer,cerrar};
}
export function cookieSesion(token,secure=false,maxAge=1800){
 return `hs_estancia=${token}; Path=/api/publico/estancia; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure?'; Secure':''}`;
}
