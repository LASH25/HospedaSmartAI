export const HUESPEDES_GATEWAY = Symbol('HUESPEDES_GATEWAY');

export interface HuespedesGateway {
  existe(id: string): Promise<boolean>;
}