export const CONVERSACIONES_REPOSITORY = Symbol(
  'CONVERSACIONES_REPOSITORY',
);

export interface ConversacionesRepository {
  registrarIntercambio(
    pregunta: string,
    respuesta: string,
  ): Promise<string>;
}