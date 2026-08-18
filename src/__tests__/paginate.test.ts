import { describe, it, expect } from "vitest";
import { fetchAllPaginated, fetchAllByIds } from "@/lib/supabase/paginate";

interface Row {
  id: string;
}

interface Calls {
  order: Array<[string, unknown]>;
  ranges: Array<[number, number]>;
  ins: Array<string[]>;
}

function emptyCalls(): Calls {
  return { order: [], ranges: [], ins: [] };
}

/** Builder PostgREST falso: `.order()` / `.in()` encadenan, `.range()` resuelve. */
function fakeQuery(rows: Row[], calls: Calls, error?: { message: string }) {
  return () => {
    let scoped = rows;
    const builder = {
      order: (column: string, opts?: unknown) => {
        calls.order.push([column, opts]);
        return builder;
      },
      in: (column: string, ids: string[]) => {
        calls.ins.push(ids);
        if (column === "id") scoped = rows.filter((r) => ids.includes(r.id));
        return builder;
      },
      range: async (from: number, to: number) => {
        calls.ranges.push([from, to]);
        if (error) return { data: null, error };
        return { data: scoped.slice(from, to + 1), error: null };
      },
    };
    return builder;
  };
}

function makeRows(count: number, prefix = "R"): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}` }));
}

describe("fetchAllPaginated", () => {
  it("ordena siempre por id para que range() tenga un orden total", async () => {
    const calls = emptyCalls();
    await fetchAllPaginated<Row>("test", fakeQuery(makeRows(3), calls));
    expect(calls.order).toEqual([["id", { ascending: true }]]);
  });

  it("recorre todas las páginas hasta recibir una incompleta", async () => {
    const calls = emptyCalls();
    const out = await fetchAllPaginated<Row>("test", fakeQuery(makeRows(2500), calls));
    expect(out).toHaveLength(2500);
    expect(calls.ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("descarta filas repetidas entre páginas en lugar de duplicar ids", async () => {
    const calls = emptyCalls();
    const duplicated = [...makeRows(3), { id: "R1" }, { id: "R0" }];
    const out = await fetchAllPaginated<Row>("test", fakeQuery(duplicated, calls));
    expect(out.map((r) => r.id)).toEqual(["R0", "R1", "R2"]);
  });

  it("propaga el error de Supabase", async () => {
    const calls = emptyCalls();
    await expect(
      fetchAllPaginated<Row>("test", fakeQuery([], calls, { message: "boom" })),
    ).rejects.toThrow("boom");
  });
});

describe("fetchAllByIds", () => {
  it("trocea los ids y pagina cada lote", async () => {
    const calls = emptyCalls();
    const ids = makeRows(1200).map((r) => r.id);
    const out = await fetchAllByIds<Row>("test", fakeQuery(makeRows(1200), calls), "id", ids);

    expect(calls.ins.map((chunk) => chunk.length)).toEqual([500, 500, 200]);
    expect(out).toHaveLength(1200);
    expect(new Set(out.map((r) => r.id)).size).toBe(1200);
  });

  it("no trunca un lote que devuelve más de una página de filas hija", async () => {
    const calls = emptyCalls();
    const ids = ["R0"];
    const children = makeRows(1500, "R");
    const out = await fetchAllByIds<Row>("test", fakeQuery(children, calls), "inmueble_id", ids);
    expect(out).toHaveLength(1500);
  });
});
