import { describe, it, expect } from "vitest";
import { destinatariosNotificacao } from "../notificacoesPolicy";

describe("destinatariosNotificacao", () => {
  it("comentário: notifica responsável + mencionados, exclui o autor", () => {
    const r = destinatariosNotificacao(
      { tipo: "comentario", autorId: "A", mencionadosIds: ["B", "C", "A"] },
      { responsavelId: "R" },
    );
    expect(r).toEqual([
      { userId: "R", tipo: "comentario" },
      { userId: "B", tipo: "mencao" },
      { userId: "C", tipo: "mencao" },
    ]);
  });

  it("comentário: autor é o próprio responsável → ninguém via comentário, só @menções", () => {
    const r = destinatariosNotificacao(
      { tipo: "comentario", autorId: "R", mencionadosIds: ["B"] },
      { responsavelId: "R" },
    );
    expect(r).toEqual([{ userId: "B", tipo: "mencao" }]);
  });

  it("comentário: menção ao responsável não duplica", () => {
    const r = destinatariosNotificacao(
      { tipo: "comentario", autorId: "A", mencionadosIds: ["R", "B"] },
      { responsavelId: "R" },
    );
    expect(r).toEqual([
      { userId: "R", tipo: "comentario" },
      { userId: "B", tipo: "mencao" },
    ]);
  });

  it("responsavel: notifica novo, ignora se for o ator ou o antigo", () => {
    expect(
      destinatariosNotificacao(
        { tipo: "responsavel", autorId: "A", novoResponsavelId: "X", antigoResponsavelId: null },
        { responsavelId: "X" },
      ),
    ).toEqual([{ userId: "X", tipo: "responsavel" }]);

    expect(
      destinatariosNotificacao(
        { tipo: "responsavel", autorId: "X", novoResponsavelId: "X", antigoResponsavelId: null },
        { responsavelId: "X" },
      ),
    ).toEqual([]);

    expect(
      destinatariosNotificacao(
        { tipo: "responsavel", autorId: "A", novoResponsavelId: "X", antigoResponsavelId: "X" },
        { responsavelId: "X" },
      ),
    ).toEqual([]);
  });

  it("não emite duplicatas para o mesmo usuário+tipo", () => {
    const r = destinatariosNotificacao(
      { tipo: "mencao", autorId: null, mencionadosIds: ["B", "B", "B"] },
      { responsavelId: null },
    );
    expect(r).toEqual([{ userId: "B", tipo: "mencao" }]);
  });
});
