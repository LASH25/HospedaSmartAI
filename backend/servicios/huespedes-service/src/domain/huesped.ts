export interface NuevoHuesped {
  nombre: string;
  email: string;
  telefono: string;
}

export interface Huesped extends NuevoHuesped {
  id: string;
  creada_en: Date;
}

export class HuespedInvalido extends Error {}

export class EmailHuespedDuplicado extends Error {}

export class HuespedNoEncontrado extends Error {}