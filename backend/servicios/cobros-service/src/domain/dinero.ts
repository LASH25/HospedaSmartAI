/** Importes exactos en centavos; nunca se suman números de punto flotante. */
export function centavos(valor: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(valor)) throw new Error('Importe decimal inválido');
  const [entero, decimal = ''] = valor.split('.');
  return BigInt(entero) * 100n + BigInt(decimal.padEnd(2, '0'));
}
export function importe(valor: bigint): string {
  const signo = valor < 0n ? '-' : '';
  const absoluto = valor < 0n ? -valor : valor;
  return `${signo}${absoluto / 100n}.${String(absoluto % 100n).padStart(2, '0')}`;
}
