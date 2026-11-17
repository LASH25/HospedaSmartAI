export const HUESPEDES_GATEWAY = Symbol('HUESPEDES_GATEWAY');
export interface HuespedesGateway { buscarPorId(id: string): Promise<{ id: string } | null>; }
