import { describe, it, expect } from "vitest";
import {
  carteiraDoUsuario,
  podeVerOportunidade,
  type ClienteCarteira,
} from "@/lib/crm/escopo";

const EU = "10";
const OUTRO = "20";

const clientes: ClienteCarteira[] = [
  { id: "1", responsaveisNegociacao: [EU] },
  { id: "2", responsaveisNegociacao: [OUTRO] },
  { id: "3", responsaveisNegociacao: [OUTRO, EU] },
  { id: "4" }, // sem responsáveis
];

/** Atalho: usuário comum (não-GM) com a carteira derivada de `clientes`. */
function restrito(userId: string | null) {
  return { restrito: true, userId, carteira: carteiraDoUsuario(clientes, userId) };
}

describe("carteiraDoUsuario", () => {
  it("junta os clientes em que o usuário é responsável, inclusive os compartilhados", () => {
    expect(carteiraDoUsuario(clientes, EU)).toEqual(new Set(["1", "3"]));
    expect(carteiraDoUsuario(clientes, OUTRO)).toEqual(new Set(["2", "3"]));
  });

  it("devolve carteira vazia para usuário sem cliente e para userId nulo", () => {
    expect(carteiraDoUsuario(clientes, "999")).toEqual(new Set());
    expect(carteiraDoUsuario(clientes, null)).toEqual(new Set());
  });
});

describe("podeVerOportunidade", () => {
  it("GM vê tudo — inclusive cliente fora da carteira e card de outro responsável", () => {
    const gm = { restrito: false, userId: EU, carteira: new Set<string>() };
    expect(podeVerOportunidade({ clienteId: "2", responsavelId: OUTRO }, gm)).toBe(true);
    expect(podeVerOportunidade({ clienteId: null, responsavelId: OUTRO }, gm)).toBe(true);
  });

  it("vê a oportunidade de um cliente da carteira mesmo com outro responsável", () => {
    expect(podeVerOportunidade({ clienteId: "1", responsavelId: OUTRO }, restrito(EU))).toBe(true);
    expect(podeVerOportunidade({ clienteId: "3", responsavelId: OUTRO }, restrito(EU))).toBe(true);
  });

  it("não vê a oportunidade de cliente fora da carteira", () => {
    expect(podeVerOportunidade({ clienteId: "2", responsavelId: OUTRO }, restrito(EU))).toBe(false);
    expect(podeVerOportunidade({ clienteId: "4", responsavelId: OUTRO }, restrito(EU))).toBe(false);
  });

  it("com carteira vazia, ainda vê os cards em que é o responsável — e só esses", () => {
    const semCarteira = restrito("999");
    expect(podeVerOportunidade({ clienteId: "2", responsavelId: "999" }, semCarteira)).toBe(true);
    expect(podeVerOportunidade({ clienteId: "2", responsavelId: OUTRO }, semCarteira)).toBe(false);
  });

  it("oportunidade sem cliente fica visível ao responsável dela, e só a ele", () => {
    expect(podeVerOportunidade({ clienteId: null, responsavelId: EU }, restrito(EU))).toBe(true);
    expect(podeVerOportunidade({ responsavelId: EU }, restrito(EU))).toBe(true);
    expect(podeVerOportunidade({ clienteId: null, responsavelId: OUTRO }, restrito(EU))).toBe(false);
  });

  it("não filtra enquanto não há usuário — evita esvaziar a tela antes da sessão carregar", () => {
    expect(podeVerOportunidade({ clienteId: "2", responsavelId: OUTRO }, restrito(null))).toBe(true);
  });
});
