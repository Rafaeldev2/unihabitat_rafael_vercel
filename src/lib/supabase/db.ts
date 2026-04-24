import type { Asset, AssetAdmin, Comprador, Vendedor, Tarea } from "../types";

/** Une mapas excel_raw al reimportar: por hoja, preferir celda no vacía del incoming. */
export function mergeExcelRawMaps(
  existing: Record<string, Record<string, string>> | null | undefined,
  incoming: Record<string, Record<string, string>> | null | undefined,
): Record<string, Record<string, string>> | undefined {
  if (!incoming || Object.keys(incoming).length === 0) return existing ?? undefined;
  if (!existing || Object.keys(existing).length === 0) return { ...incoming };
  const out: Record<string, Record<string, string>> = { ...existing };
  for (const sheet of Object.keys(incoming)) {
    const inc = incoming[sheet];
    const prev = out[sheet] ?? {};
    const merged: Record<string, string> = { ...prev };
    const keys = new Set([...Object.keys(prev), ...Object.keys(inc)]);
    for (const k of keys) {
      const bv = inc[k];
      const av = merged[k];
      const bOk = bv != null && bv !== "" && bv !== "—";
      const aOk = av != null && av !== "" && av !== "—";
      if (bOk) merged[k] = bv;
      else if (aOk) merged[k] = av;
      else merged[k] = (bv ?? av ?? "") as string;
    }
    out[sheet] = merged;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Row ↔ Model mappers (snake_case DB ↔ camelCase App)               */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToAsset(r: any): Asset {
  const adm: AssetAdmin = {
    pip: r.adm_pip ?? "—", lin: r.adm_lin ?? "—", cat: r.adm_cat ?? "—",
    car: r.adm_car ?? "—", cli: r.adm_cli ?? "—", id1: r.adm_id1 ?? "—",
    con: r.adm_con ?? "—", aid: r.adm_aid ?? "—", loans: r.adm_loans ?? "—",
    tcol: r.adm_tcol ?? "—", scol: r.adm_scol ?? "—", ccaa: r.adm_ccaa ?? "—",
    prov: r.adm_prov ?? "—", city: r.adm_city ?? "—", zip: r.adm_zip ?? "—",
    addr: r.adm_addr ?? "—", finca: r.adm_finca ?? "—", reg: r.adm_reg ?? "—",
    cref: r.adm_cref ?? "—", ejud: r.adm_ejud ?? "—", ejmap: r.adm_ejmap ?? "—",
    eneg: r.adm_eneg ?? "—", ob: r.adm_ob ?? "—", sub: r.adm_sub ?? "—",
    deu: r.adm_deu ?? "—", cprev: r.adm_cprev ?? "—", cpost: r.adm_cpost ?? "—",
    dtot: r.adm_dtot ?? "—", pest: r.adm_pest ?? "—", str: r.adm_str ?? "—",
    liq: r.adm_liq ?? "—", avj: r.adm_avj ?? "—", mmap: r.adm_mmap ?? "—",
    buck: r.adm_buck ?? "—", lbuck: r.adm_lbuck ?? "—", smf: r.adm_smf ?? "—",
    rsub: r.adm_rsub ?? "—", conn: r.adm_conn ?? "—", conn2: r.adm_conn2 ?? "—",
  };

  return {
    id: r.id, cat: r.cat ?? "—", prov: r.prov ?? "—", pob: r.pob ?? "—",
    cp: r.cp ?? "—", addr: r.addr ?? "—", tip: r.tip ?? "Vivienda",
    tipC: r.tip_c ?? "tp-viv", fase: r.fase ?? "Suspendido", faseC: r.fase_c ?? "fp-sus",
    precio: r.precio != null ? Number(r.precio) : null,
    fav: r.fav ?? false, chk: false, sqm: r.sqm != null ? Number(r.sqm) : null,
    tvia: r.tvia ?? "—", nvia: r.nvia ?? "—", num: r.num ?? "—",
    esc: r.esc ?? "—", pla: r.pla ?? "—", pta: r.pta ?? "—",
    map: r.map ?? "", catRef: r.cat_ref ?? "—",
    clase: r.clase ?? "—", uso: r.uso ?? "—", bien: r.bien ?? "—",
    supC: r.sup_c ?? "—", supG: r.sup_g ?? "—", coef: r.coef ?? "—",
    ccaa: r.ccaa ?? "—", fullAddr: r.full_addr ?? "—", desc: r.descr ?? "—",
    ownerName: r.owner_name ?? "—", ownerTel: r.owner_tel ?? "—",
    ownerMail: r.owner_mail ?? "—", adm, pub: r.pub ?? false, age: r.age,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    ...(r.excel_raw && typeof r.excel_raw === "object" && !Array.isArray(r.excel_raw)
      ? { excelRaw: r.excel_raw as Record<string, Record<string, string>> }
      : {}),
  };
}

export function assetToRow(a: Asset) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {
    id: a.id, cat: a.cat, prov: a.prov, pob: a.pob, cp: a.cp, addr: a.addr,
    tip: a.tip, tip_c: a.tipC, fase: a.fase, fase_c: a.faseC, precio: a.precio,
    fav: a.fav, sqm: a.sqm, tvia: a.tvia, nvia: a.nvia, num: a.num,
    esc: a.esc, pla: a.pla, pta: a.pta, map: a.map, cat_ref: a.catRef,
    clase: a.clase, uso: a.uso, bien: a.bien, sup_c: a.supC, sup_g: a.supG,
    coef: a.coef, ccaa: a.ccaa, full_addr: a.fullAddr, descr: a.desc,
    owner_name: a.ownerName, owner_tel: a.ownerTel, owner_mail: a.ownerMail,
    pub: a.pub, age: a.age,
    adm_pip: a.adm.pip, adm_lin: a.adm.lin, adm_cat: a.adm.cat,
    adm_car: a.adm.car, adm_cli: a.adm.cli, adm_id1: a.adm.id1,
    adm_con: a.adm.con, adm_aid: a.adm.aid, adm_loans: a.adm.loans,
    adm_tcol: a.adm.tcol, adm_scol: a.adm.scol, adm_ccaa: a.adm.ccaa,
    adm_prov: a.adm.prov, adm_city: a.adm.city, adm_zip: a.adm.zip,
    adm_addr: a.adm.addr, adm_finca: a.adm.finca, adm_reg: a.adm.reg,
    adm_cref: a.adm.cref, adm_ejud: a.adm.ejud, adm_ejmap: a.adm.ejmap,
    adm_eneg: a.adm.eneg, adm_ob: a.adm.ob, adm_sub: a.adm.sub,
    adm_deu: a.adm.deu, adm_cprev: a.adm.cprev, adm_cpost: a.adm.cpost,
    adm_dtot: a.adm.dtot, adm_pest: a.adm.pest, adm_str: a.adm.str,
    adm_liq: a.adm.liq, adm_avj: a.adm.avj, adm_mmap: a.adm.mmap,
    adm_buck: a.adm.buck, adm_lbuck: a.adm.lbuck, adm_smf: a.adm.smf,
    adm_rsub: a.adm.rsub, adm_conn: a.adm.conn, adm_conn2: a.adm.conn2,
  };
  if (a.lat != null) row.lat = a.lat;
  if (a.lng != null) row.lng = a.lng;
  if (a.excelRaw && Object.keys(a.excelRaw).length > 0) row.excel_raw = a.excelRaw;
  return row;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToComprador(r: any): Comprador {
  return {
    id: r.id, nombre: r.nombre, ini: r.ini ?? "", col: r.col ?? "#2563a8,#0d2a4a",
    tipo: r.tipo ?? "Free", agente: r.agente ?? "Admin", email: r.email,
    tel: r.tel ?? "", intereses: r.intereses ?? "", presupuesto: r.presupuesto ?? "",
    activos: r.activos ?? "0", actividad: r.actividad ?? "",
    estado: r.estado ?? "Nuevo", estadoC: r.estado_c ?? "fp-nd",
    nda: r.nda ?? "Pendiente",
  };
}

export function compradorToRow(c: Comprador) {
  return {
    id: c.id, nombre: c.nombre, ini: c.ini, col: c.col, tipo: c.tipo,
    agente: c.agente, email: c.email, tel: c.tel, intereses: c.intereses,
    presupuesto: c.presupuesto, activos: c.activos, actividad: c.actividad,
    estado: c.estado, estado_c: c.estadoC, nda: c.nda,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToVendedor(r: any): Vendedor {
  return {
    id: r.id, nombre: r.nombre, ini: r.ini ?? "", col: r.col ?? "#2563a8,#0d2a4a",
    cartera: r.cartera ?? "", activo: r.activo ?? "", agente: r.agente ?? "Admin",
    tel: r.tel ?? "", email: r.email ?? "", ultimo: r.ultimo ?? "",
    estado: r.estado ?? "", estadoC: r.estado_c ?? "fp-nd",
  };
}

export function vendedorToRow(v: Vendedor) {
  return {
    id: v.id, nombre: v.nombre, ini: v.ini, col: v.col, cartera: v.cartera,
    activo: v.activo, agente: v.agente, tel: v.tel, email: v.email,
    ultimo: v.ultimo, estado: v.estado, estado_c: v.estadoC,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToTarea(r: any): Tarea {
  return {
    id: r.id, titulo: r.titulo, agente: r.agente ?? "Admin",
    detalle: r.detalle ?? "", prioridad: r.prioridad ?? "normal",
    fecha: r.fecha ?? "", done: r.done ?? false,
  };
}

export function tareaToRow(t: Tarea) {
  return {
    id: t.id, titulo: t.titulo, agente: t.agente, detalle: t.detalle,
    prioridad: t.prioridad, fecha: t.fecha, done: t.done,
  };
}
