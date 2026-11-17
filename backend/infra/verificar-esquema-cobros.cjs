const { NestFactory } = require('@nestjs/core');
const { DataSource } = require('typeorm');
const { AppModule } = require('./dist/app.module');
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, {logger:false});
  try {
    const db=app.get(DataSource);
    const tables=await db.query("SELECT TABLE_NAME AS nombre, ENGINE AS motor FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('cuentas','consumos','pagos')");
    if(tables.length!==3 || tables.some(x=>x.motor!=='InnoDB')) throw Error('Se requieren cuentas, consumos y pagos con motor InnoDB.');
    await db.query('SELECT id, estado, total_estancia FROM cuentas LIMIT 0');
    await db.query('SELECT id, cuenta_id, concepto, cantidad, precio_unitario, subtotal, creada_en FROM consumos LIMIT 0');
    await db.query('SELECT id, cuenta_id, clave_idempotencia, monto, metodo, referencia, creada_en FROM pagos LIMIT 0');
    const indices=await db.query("SELECT INDEX_NAME AS nombre, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pagos' AND NON_UNIQUE=0 GROUP BY INDEX_NAME");
    if(!indices.some(x=>x.columnas==='clave_idempotencia')) throw Error('Falta índice único de clave_idempotencia en pagos.');
    console.log('OK: tablas InnoDB, columnas e índice único de pagos presentes.');
  } finally { await app.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
