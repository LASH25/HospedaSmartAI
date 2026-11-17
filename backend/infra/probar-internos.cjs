// Ejecutar dentro de reservas-service; no muestra las claves de servicio.
(async()=>{
 const headers={'x-hospeda-servicio':process.env.INTERNAL_SERVICE_NAME,'x-hospeda-clave':process.env.INTERNAL_SERVICE_TOKEN};
 const root=process.env.HABITACIONES_SERVICE_URL;
 const tests=[
  ['GET','/habitaciones/00000000-0000-4000-8000-000000000000',headers,404],
  ['GET','/habitaciones',headers,403],
  ['POST','/habitaciones',headers,403],
  ['GET','/habitaciones',{'x-hospeda-servicio':'reservas','x-hospeda-clave':'incorrecta'},401],
 ];
 for(const [method,path,h,expected] of tests){
  const r=await fetch(new URL(path,root),{method,headers:h,signal:AbortSignal.timeout(10000)});
  if(r.status!==expected)throw Error(`${method} ${path}: esperado ${expected}, recibido ${r.status}`);
 }
 console.log('OK: credencial interna: lectura por ID; listado y escritura de rutas públicas bloqueados.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
