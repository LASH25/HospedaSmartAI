export const CLAVES_SERVICE = Symbol('CLAVES_SERVICE');

export interface ClavesService {
  generar(password: string): Promise<string>;
  verificar(password: string, hash: string): Promise<boolean>;
}