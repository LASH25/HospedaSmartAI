// Migración aditiva e idempotente; ejecuta solo el esquema del servicio actual.
const { NestFactory }=require('@nestjs/core');
const { DataSource }=require('typeorm');
const { AppModule }=require('./dist/app.module');
(async()=>{
 const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
 try{
  const db=app.get(DataSource);const servicio=process.env.SERVICE_NAME;
  if(servicio==='reservas')await db.query(`CREATE TABLE IF NOT EXISTS procesos_estancia (
   reserva_id CHAR(36) PRIMARY KEY,
   fase VARCHAR(24) NOT NULL,
   entrada_en TIMESTAMP NULL DEFAULT NULL,
   salida_en TIMESTAMP NULL DEFAULT NULL,
   actualizada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   CONSTRAINT procesos_estancia_fase_valida CHECK(fase IN ('entrada_pendiente','en_estancia','salida_pendiente','finalizada')),
   FOREIGN KEY(reserva_id) REFERENCES reservas(id)
  ) ENGINE=InnoDB`);
  else if(servicio==='habitaciones')await db.query(`CREATE TABLE IF NOT EXISTS estancias_habitacion (
   reserva_id CHAR(36) PRIMARY KEY,
   habitacion_id CHAR(36) NOT NULL,
   estado VARCHAR(20) NOT NULL,
   entrada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   salida_en TIMESTAMP NULL DEFAULT NULL,
   habitacion_activa CHAR(36) GENERATED ALWAYS AS (CASE WHEN estado='en_estancia' THEN habitacion_id ELSE NULL END) STORED,
   UNIQUE KEY una_estancia_activa_por_habitacion(habitacion_activa),
   INDEX estancias_habitacion_buscar(habitacion_id,estado),
   CONSTRAINT estancias_habitacion_estado_valido CHECK(estado IN ('en_estancia','finalizada')),
   FOREIGN KEY(habitacion_id) REFERENCES habitaciones(id)
  ) ENGINE=InnoDB`);
  else throw Error('Ejecuta la migración únicamente dentro de reservas o habitaciones.');
  console.log('OK: tabla de estancias preparada en '+servicio+'. No se borraron registros.');
 }finally{await app.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
