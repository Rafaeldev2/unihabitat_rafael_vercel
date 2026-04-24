export interface AssetAdmin {
  pip: string;
  lin: string;
  cat: string;
  car: string;
  cli: string;
  id1: string;
  con: string;
  aid: string;
  loans: string;
  tcol: string;
  scol: string;
  ccaa: string;
  prov: string;
  city: string;
  zip: string;
  addr: string;
  finca: string;
  reg: string;
  cref: string;
  ejud: string;
  ejmap: string;
  eneg: string;
  ob: string;
  sub: string;
  deu: string;
  cprev: string;
  cpost: string;
  dtot: string;
  pest: string;
  str: string;
  liq: string;
  avj: string;
  mmap: string;
  buck: string;
  lbuck: string;
  smf: string;
  rsub: string;
  conn: string;
  conn2: string;
}

export interface Asset {
  id: string;
  cat: string;
  prov: string;
  pob: string;
  cp: string;
  addr: string;
  tip: string;
  tipC: string;
  fase: string;
  faseC: string;
  precio: number | null;
  fav: boolean;
  chk: boolean;
  sqm: number | null;
  tvia: string;
  nvia: string;
  num: string;
  esc: string;
  pla: string;
  pta: string;
  map: string;
  catRef: string;
  clase: string;
  uso: string;
  bien: string;
  supC: string;
  supG: string;
  coef: string;
  ccaa: string;
  fullAddr: string;
  desc: string;
  ownerName: string;
  ownerTel: string;
  ownerMail: string;
  adm: AssetAdmin;
  /** Por hoja de Excel: cabeceras → valores en bruto (tras importar). */
  excelRaw?: Record<string, Record<string, string>>;
  pub: boolean;
  age?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface Comprador {
  id: string;
  nombre: string;
  ini: string;
  col: string;
  tipo: "Privado" | "Free";
  agente: string;
  email: string;
  tel: string;
  intereses: string;
  presupuesto: string;
  activos: string;
  actividad: string;
  estado: string;
  estadoC: string;
  nda: "Firmada" | "Pendiente";
}

export interface Vendedor {
  id: string;
  nombre: string;
  ini: string;
  col: string;
  cartera: string;
  activo: string;
  agente: string;
  tel: string;
  email: string;
  ultimo: string;
  estado: string;
  estadoC: string;
}

export interface Tarea {
  id: string;
  titulo: string;
  agente: string;
  detalle: string;
  prioridad: "urgente" | "normal" | "baja" | "completada";
  fecha: string;
  done: boolean;
}

export interface NoteEntry {
  author: string;
  date: string;
  text: string;
}

export interface DocItem {
  name: string;
  meta: string;
  iconType: "pdf" | "xls" | "img";
}

export interface ChatMessage {
  from: "cli" | "adm";
  text: string;
  time: string;
}
