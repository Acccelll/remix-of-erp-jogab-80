import { describe, it, expect, beforeEach } from "vitest";
import { enfileirar, recorded, reset, supabaseFalso } from "./_duplo-supabase";

/**
 * O dublê virou infraestrutura de treze arquivos de contrato — e até aqui
 * ninguém o testava. Estes casos fixam as três coisas de que aqueles arquivos
 * dependem: que qualquer método seja gravado, que `await` entregue o resultado
 * combinado, e que cada `from()` vire uma gravação separada.
 */
describe("dublê de Supabase", () => {
  beforeEach(() => reset());

  it("grava qualquer método da cadeia, inclusive um que nenhuma lista previa", async () => {
    // É esta a razão de existir do Proxy: com lista fixa de métodos, `contains`
    // seria `undefined` e a chamada estouraria com "não é uma função".
    await supabaseFalso
      .from("cards")
      .select("id")
      .contains("tags", ["urgente"])
      .range(0, 49);

    expect(recorded).toHaveLength(1);
    expect(recorded[0].table).toBe("cards");
    expect(recorded[0].ops).toEqual([
      { op: "select", args: ["id"] },
      { op: "contains", args: ["tags", ["urgente"]] },
      { op: "range", args: [0, 49] },
    ]);
  });

  it("await entrega a resposta configurada", async () => {
    reset({ data: [{ id: "1" }], error: null });
    const { data, error } = await supabaseFalso.from("obras").select("*");
    expect(data).toEqual([{ id: "1" }]);
    expect(error).toBeNull();
  });

  it("devolve o erro para quem propaga", async () => {
    reset({ data: null, error: new Error("rls") });
    const { error } = await supabaseFalso.from("obras").select("*");
    expect(error).toEqual(new Error("rls"));
  });

  it("entrega a fila em ordem e depois volta ao padrão", async () => {
    reset({ data: "padrao", error: null });
    enfileirar({ data: "primeira", error: null }, { data: "segunda", error: null });

    const um = await supabaseFalso.from("t").select("*");
    const dois = await supabaseFalso.from("t").select("*");
    const tres = await supabaseFalso.from("t").select("*");

    expect([um.data, dois.data, tres.data]).toEqual(["primeira", "segunda", "padrao"]);
  });

  it("separa uma gravação por from(), na ordem das idas ao banco", async () => {
    await supabaseFalso.from("obras").select("id");
    await supabaseFalso.from("cards").delete().eq("id", "c1");

    expect(recorded.map((r) => r.table)).toEqual(["obras", "cards"]);
    expect(recorded[1].ops.map((o) => o.op)).toEqual(["delete", "eq"]);
  });

  it("reset limpa as gravações e a fila entre um teste e outro", async () => {
    enfileirar({ data: "sobra", error: null });
    reset({ data: "limpo", error: null });

    const { data } = await supabaseFalso.from("t").select("*");
    expect(data).toBe("limpo");
    expect(recorded).toHaveLength(1);
  });
});
