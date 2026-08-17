// PRO-031 · Fase 3 — ponte matriz ⇄ acessos legado e decisão fina por player.
import { describe, expect, it } from "vitest";
import { HIDDEN_NAV_ITEMS, NAV_ITEMS } from "@/config/navigation";
import {
  acessosDerivadosDeMatriz,
  listarModulos,
  matrizDeAcessosLegados,
  migrarRotasFundidas,
  normalizarSetores,
  normalizarSetorLegado,
  podeAcao,
  podePlayerAcao,
  podePlayerVerSetorFinanceiro,
  rotaDaMatrizPara,
  rotasDaMatriz,
  setorLabel,
  setoresVisiveis,
} from "@/lib/authz/paginas";

const rotaFrotas = "/veiculos";
const rotaRh = "/rh/colaboradores";

describe("listarModulos", () => {
  it("cada página carrega a PageKey do item de navegação", () => {
    const paginas = listarModulos().flatMap((m) => m.paginas);
    expect(paginas.length).toBeGreaterThan(0);
    for (const pg of paginas) expect(pg.permission).toBeTruthy();
    expect(paginas.find((p) => p.rota === rotaFrotas)?.permission).toBe("frotas");
  });
});

describe("acessosDerivadosDeMatriz — agregação por página", () => {
  it("frotas deriva do V/E de /veiculos (antes impossível: módulo 'ativos' colapsava tudo)", () => {
    const acessos = acessosDerivadosDeMatriz({ [rotaFrotas]: { V: true, E: true } });
    expect(acessos.frotas).toBe("editar");
    expect(acessos.patrimonios).toBe("nenhum");
  });

  it("V sem E deriva visualizar; página de outra PageKey não interfere", () => {
    const acessos = acessosDerivadosDeMatriz({ [rotaRh]: { V: true } });
    expect(acessos.rh).toBe("visualizar");
    expect(acessos.dp).toBe("nenhum");
  });

  it("papéis especiais elevam financeiro", () => {
    expect(acessosDerivadosDeMatriz({}, { aprovarFinanceiro: true }).financeiro).toBe("financeiro");
    expect(acessosDerivadosDeMatriz({}, { aprovarCompras: true }).financeiro).toBe("compras");
  });
});

describe("matrizDeAcessosLegados — semântica histórica preservada", () => {
  it("visualizar concede V e Ex; editar concede também E, X e I", () => {
    const m = matrizDeAcessosLegados({ rh: "editar", frotas: "visualizar" });
    expect(podeAcao(m, rotaRh, "V")).toBe(true);
    expect(podeAcao(m, rotaRh, "E")).toBe(true);
    expect(podeAcao(m, rotaRh, "X")).toBe(true);
    expect(podeAcao(m, rotaRh, "I")).toBe(true);
    expect(podeAcao(m, rotaFrotas, "V")).toBe(true);
    expect(podeAcao(m, rotaFrotas, "Ex")).toBe(true);
    expect(podeAcao(m, rotaFrotas, "E")).toBe(false);
    expect(podeAcao(m, rotaFrotas, "X")).toBe(false);
  });

  it("round-trip: legado → matriz → acessos derivados devolve os mesmos níveis", () => {
    const original = { rh: "editar", frotas: "visualizar" } as const;
    const derivado = acessosDerivadosDeMatriz(matrizDeAcessosLegados(original));
    expect(derivado.rh).toBe("editar");
    expect(derivado.frotas).toBe("visualizar");
    expect(derivado.crm).toBe("nenhum");
  });
});

describe("normalizarSetores — allowlist espelhada na edge sync-player-auth", () => {
  it("filtra valores fora do enum, normaliza caixa/espaços e deduplica", () => {
    expect(normalizarSetores([" Fiscalizacao ", "financeiro", "hacker", "financeiro"])).toEqual([
      "fiscalizacao",
      "financeiro",
    ]);
  });

  it("entrada não-array ou vazia vira lista vazia", () => {
    expect(normalizarSetores(undefined)).toEqual([]);
    expect(normalizarSetores("financeiro")).toEqual([]);
    expect(normalizarSetores([1, null])).toEqual([]);
  });

  it("gm/comum nunca são setores atribuíveis", () => {
    expect(normalizarSetores(["gm", "comum", "qualidade"])).toEqual(["qualidade"]);
  });
});

describe("podePlayerAcao", () => {
  it("GM tem tudo; sem player nada", () => {
    expect(podePlayerAcao({ isGM: true }, rotaRh, "X")).toBe(true);
    expect(podePlayerAcao(null, rotaRh, "V")).toBe(false);
  });

  it("matriz salva é fonte-verdade (ignora acessos legado)", () => {
    const player = {
      isGM: false,
      matrizPermissoes: { [rotaRh]: { V: true } },
      acessos: { rh: "editar" as const },
    };
    expect(podePlayerAcao(player, rotaRh, "V")).toBe(true);
    expect(podePlayerAcao(player, rotaRh, "E")).toBe(false);
  });

  it("sem matriz, deriva do legado (editar ⇒ pode excluir)", () => {
    const player = { isGM: false, acessos: { rh: "editar" as const } };
    expect(podePlayerAcao(player, rotaRh, "X")).toBe(true);
    expect(podePlayerAcao(player, rotaFrotas, "V")).toBe(false);
  });
});

describe("gate fino por página no módulo financeiro (regressão do 'módulo todo')", () => {
  const rotaAprovacao = "/financeiro/aprovacao";
  const rotaDashboard = "/financeiro/dashboard";

  it("rotasDaMatriz cobre as páginas do NAV financeiro", () => {
    const rotas = rotasDaMatriz();
    expect(rotas.has(rotaAprovacao)).toBe(true);
    expect(rotas.has(rotaDashboard)).toBe(true);
  });

  it("liberar só a Aprovação Financeira NÃO abre as outras páginas do módulo", () => {
    // Todas as páginas do financeiro compartilham a PageKey "financeiro"; a
    // matriz salva concede apenas /financeiro/aprovacao.
    const player = {
      isGM: false,
      matrizPermissoes: { [rotaAprovacao]: { V: true } },
    };
    expect(podePlayerAcao(player, rotaAprovacao, "V")).toBe(true);
    expect(podePlayerAcao(player, rotaDashboard, "V")).toBe(false);
  });

  it("usuário legado (só acessos, sem matriz) mantém o módulo inteiro", () => {
    const player = { isGM: false, acessos: { financeiro: "visualizar" as const } };
    expect(podePlayerAcao(player, rotaAprovacao, "V")).toBe(true);
    expect(podePlayerAcao(player, rotaDashboard, "V")).toBe(true);
  });
});

describe("normalizarSetorLegado — canoniza slug/rótulo/legado", () => {
  it("slug canônico passa direto", () => {
    expect(normalizarSetorLegado("dp")).toBe("dp");
    expect(normalizarSetorLegado(" Financeiro ")).toBe("financeiro");
  });

  it("rótulo canônico vira slug", () => {
    expect(normalizarSetorLegado("Depto. Pessoal")).toBe("dp");
    expect(normalizarSetorLegado("Engenharia")).toBe("engenharia");
  });

  it("rótulos legados da Aprovação Financeira mapeiam para slug", () => {
    expect(normalizarSetorLegado("RH")).toBe("dp");
    expect(normalizarSetorLegado("Compras")).toBe("compras");
  });

  it("Almoxarifado e Frotas caem no setor próprio, não no antigo destino", () => {
    // Enquanto não existiam como setor, colapsavam em compras/engenharia. É por
    // aqui que as linhas antigas, gravadas com o rótulo por extenso, voltam ao
    // setor certo — some daqui e elas voltam a ser vistas como Compras.
    expect(normalizarSetorLegado("Almoxarifado")).toBe("almoxarifado");
    expect(normalizarSetorLegado("Frotas")).toBe("frotas");
  });

  it("valor desconhecido é preservado (não some do GM)", () => {
    expect(normalizarSetorLegado("Diretoria")).toBe("Diretoria");
    expect(normalizarSetorLegado("")).toBe("");
    expect(normalizarSetorLegado(null)).toBe("");
  });
});

describe("setorLabel — slug/legado para rótulo exibível", () => {
  it("mapeia para o rótulo canônico", () => {
    expect(setorLabel("dp")).toBe("Depto. Pessoal");
    expect(setorLabel("RH")).toBe("Depto. Pessoal");
    expect(setorLabel("almoxarifado")).toBe("Almoxarifado");
    expect(setorLabel("Frotas")).toBe("Frotas");
  });

  it("desconhecido devolve o próprio texto", () => {
    expect(setorLabel("Diretoria")).toBe("Diretoria");
    expect(setorLabel("")).toBe("");
  });
});

describe("setoresVisiveis / podePlayerVerSetorFinanceiro", () => {
  it("GM vê todos os setores e qualquer solicitação", () => {
    const gm = { isGM: true };
    expect(setoresVisiveis(gm)).toContain("dp");
    expect(setoresVisiveis(gm).length).toBeGreaterThanOrEqual(7);
    expect(podePlayerVerSetorFinanceiro(gm, "Diretoria")).toBe(true);
  });

  it("não-GM só vê os setores concedidos (inclusive via rótulo legado)", () => {
    const player = { isGM: false, papeisPermissao: { setores: ["dp"] } };
    expect(setoresVisiveis(player)).toEqual(["dp"]);
    expect(podePlayerVerSetorFinanceiro(player, "dp")).toBe(true);
    expect(podePlayerVerSetorFinanceiro(player, "Depto. Pessoal")).toBe(true);
    expect(podePlayerVerSetorFinanceiro(player, "RH")).toBe(true); // RH → dp
    expect(podePlayerVerSetorFinanceiro(player, "financeiro")).toBe(false);
    expect(podePlayerVerSetorFinanceiro(player, "Compras")).toBe(false);
  });

  it("Almoxarifado e Frotas são atribuíveis como qualquer outro setor", () => {
    // Passar pela allowlist do `normalizarSetores` é o que faz o setor chegar
    // da tela de Permissões até aqui; fora dela, conceder não teria efeito.
    const player = {
      isGM: false,
      papeisPermissao: { setores: ["almoxarifado", "frotas"] },
    };
    expect(setoresVisiveis(player)).toEqual(["almoxarifado", "frotas"]);
    expect(podePlayerVerSetorFinanceiro(player, "Almoxarifado")).toBe(true);
    expect(podePlayerVerSetorFinanceiro(player, "frotas")).toBe(true);
  });

  it("conceder Compras não abre Almoxarifado — nem o contrário", () => {
    // A separação que dá sentido aos setores novos: antes Almoxarifado caía em
    // compras e quem tinha Compras via as duas coisas. Idem Frotas em engenharia.
    //
    // Cuidado ao ler isto como rede de segurança do mapa legado: não é. Em TS o
    // slug canônico é testado antes do mapa, então repor `almoxarifado: "compras"`
    // lá não quebra nada aqui. Quem sente é o gêmeo PHP — `setoresRawAceitosFin`
    // deriva o WHERE do mapa e voltaria a aceitar as linhas. Sem teste de PHP no
    // repo, esse lado se sustenta em api.php:725 e no §8.1 do access-control.md.
    const compras = { isGM: false, papeisPermissao: { setores: ["compras"] } };
    const almox = { isGM: false, papeisPermissao: { setores: ["almoxarifado"] } };
    expect(podePlayerVerSetorFinanceiro(compras, "Almoxarifado")).toBe(false);
    expect(podePlayerVerSetorFinanceiro(almox, "Compras")).toBe(false);

    const eng = { isGM: false, papeisPermissao: { setores: ["engenharia"] } };
    expect(podePlayerVerSetorFinanceiro(eng, "Frotas")).toBe(false);
  });

  it("não-GM sem setores e player nulo não veem nada", () => {
    expect(setoresVisiveis({ isGM: false })).toEqual([]);
    expect(podePlayerVerSetorFinanceiro({ isGM: false }, "dp")).toBe(false);
    expect(podePlayerVerSetorFinanceiro(null, "dp")).toBe(false);
  });
});

// --- rotaDaMatrizPara: qual linha da matriz governa cada rota -------------
// A matriz só tem linha para NAV_REGISTRY. Sem este resolvedor, as 43 páginas
// de HIDDEN_NAV_ITEMS e as rotas dinâmicas ficavam sem gate fino (RequireAccess
// afrouxava para o módulo inteiro) e sumiam do Command Palette.
describe("rotaDaMatrizPara", () => {
  it("devolve a própria rota quando ela tem linha na matriz", () => {
    const alguma = [...rotasDaMatriz()][0];
    expect(rotaDaMatrizPara(alguma)).toBe(alguma);
    expect(rotaDaMatrizPara("/financeiro/aprovacao")).toBe("/financeiro/aprovacao");
  });

  it("resolve rotas dinâmicas pelo prefixo mais longo", () => {
    expect(rotaDaMatrizPara("/obras/123")).toBe("/obras");
    expect(rotaDaMatrizPara("/quadros/abc-def")).toBe("/quadros");
    expect(rotaDaMatrizPara("/inspecoes/modelo-9")).toBe("/inspecoes");
    expect(rotaDaMatrizPara("/crm/oportunidades/42")).toBe("/crm");
  });

  it("resolve abas de hub que compartilham prefixo", () => {
    expect(rotaDaMatrizPara("/patrimonios/lista")).toBe("/patrimonios");
    expect(rotaDaMatrizPara("/contratos/lista")).toBe("/contratos");
    expect(rotaDaMatrizPara("/planejamento/ppc")).toBe("/planejamento");
    expect(rotaDaMatrizPara("/financeiro/fluxo/caixa")).toBe("/financeiro/fluxo");
    expect(rotaDaMatrizPara("/dp/custos/colaborador")).toBe("/dp/custos");
  });

  it("resolve, via ROTA_MAE, abas que mudaram de lugar e perderam o prefixo", () => {
    expect(rotaDaMatrizPara("/financeiro/centros")).toBe("/financeiro/cadastros");
    expect(rotaDaMatrizPara("/financeiro/naturezas")).toBe("/financeiro/cadastros");
    expect(rotaDaMatrizPara("/financeiro/dividas")).toBe("/financeiro/fluxo");
    expect(rotaDaMatrizPara("/financeiro/previsao-pagamento")).toBe("/financeiro/fluxo");
    expect(rotaDaMatrizPara("/financeiro/importar")).toBe("/financeiro/lancamentos");
    expect(rotaDaMatrizPara("/quadro-patrimonios")).toBe("/patrimonios");
    expect(rotaDaMatrizPara("/quadro-contratos")).toBe("/contratos");
    expect(rotaDaMatrizPara("/dp/horas-extras")).toBe("/dp/custos");
    expect(rotaDaMatrizPara("/dp/fopag")).toBe("/dp/custos");
    expect(rotaDaMatrizPara("/quadro-logistica-ativos")).toBe("/logistica-ativos");
    // Redirects para o hub de Ponto: resolvidos pelo prefixo, sem ROTA_MAE.
    expect(rotaDaMatrizPara("/dp/ponto/importar")).toBe("/dp/ponto");
    expect(rotaDaMatrizPara("/dp/homem-hora")).toBe("/dp/custos");
  });

  it("devolve null quando nada governa a rota (cai no gate grosso)", () => {
    expect(rotaDaMatrizPara("/rota-que-nao-existe")).toBeNull();
    expect(rotaDaMatrizPara("/")).toBeNull(); // home é alwaysVisible, sem linha
  });

  it("toda página de HIDDEN_NAV_ITEMS passa a ter uma linha que a governa", () => {
    const semGate = HIDDEN_NAV_ITEMS.filter((i) => rotaDaMatrizPara(i.to) === null);
    expect(semGate.map((i) => i.to)).toEqual([]);
  });

  it("liberar uma página do Financeiro não abre as outras", () => {
    // Só /financeiro/dashboard marcado: previsão de pagamento e cadastros ficam fora.
    const player = {
      isGM: false,
      matrizPermissoes: { "/financeiro/dashboard": { V: true } },
    };
    const podeVer = (rota: string) => podePlayerAcao(player, rotaDaMatrizPara(rota) ?? rota, "V");
    expect(podeVer("/financeiro/dashboard")).toBe(true);
    expect(podeVer("/financeiro/previsao-pagamento")).toBe(false);
    expect(podeVer("/financeiro/centros")).toBe(false);
    expect(podeVer("/financeiro/importar")).toBe(false);
  });
});

// --- Suprimentos/Almoxarifado é módulo próprio -----------------------------
// Antes, `/suprimentos` declarava permission "obras_div": conceder Suprimentos
// gravava acesso_obras e, com o gate por módulo do api.php, liberava medições e
// notas fiscais das obras. Estes testes travam a separação.
describe("módulo Almoxarifado (Suprimentos)", () => {
  it("conceder Suprimentos deriva almoxarifado, e NÃO obras_div", () => {
    const d = acessosDerivadosDeMatriz({ "/suprimentos": { V: true } });
    expect(d.almoxarifado).toBe("visualizar");
    expect(d.obras_div).toBe("nenhum");
  });

  it("conceder Obras não concede Suprimentos", () => {
    const d = acessosDerivadosDeMatriz({ "/obras": { V: true, E: true } });
    expect(d.obras_div).toBe("editar");
    expect(d.almoxarifado).toBe("nenhum");
  });

  it("todas as páginas de Suprimentos usam a PageKey almoxarifado", () => {
    const suprimentos = NAV_ITEMS.filter((i) => i.to.startsWith("/suprimentos"));
    expect(suprimentos.length).toBeGreaterThan(10);
    const fora = suprimentos.filter((i) => i.permission !== "almoxarifado");
    expect(fora.map((i) => i.to)).toEqual([]);
  });

  it("nenhuma outra página vaza para a PageKey almoxarifado", () => {
    const outras = NAV_ITEMS.filter(
      (i) => i.permission === "almoxarifado" && !i.to.startsWith("/suprimentos"),
    );
    expect(outras.map((i) => i.to)).toEqual([]);
  });
});

describe("migrarRotasFundidas — páginas que viraram aba de outra", () => {
  it("herda a permissão de /dp/fopag em /dp/custos e descarta a linha morta", () => {
    const antes = { "/dp/fopag": { V: true, Ex: true } };
    const depois = migrarRotasFundidas(antes);
    expect(depois["/dp/fopag"]).toBeUndefined();
    expect(depois["/dp/custos"]).toEqual({ V: true, Ex: true });
  });

  it("une as ações quando o destino já tinha permissão, sem rebaixar", () => {
    const depois = migrarRotasFundidas({
      "/dp/fopag": { V: true, I: true },
      "/dp/custos": { V: true, E: true },
    });
    expect(depois["/dp/custos"]).toEqual({ V: true, E: true, I: true });
  });

  it("não inventa acesso para quem não tinha a rota antiga", () => {
    const antes = { "/dp/ponto": { V: true } };
    expect(migrarRotasFundidas(antes)).toBe(antes); // mesma referência: nada a fazer
    expect(migrarRotasFundidas(antes)["/dp/custos"]).toBeUndefined();
  });

  it("é idempotente e não muta a matriz recebida", () => {
    const antes = { "/dp/fopag": { V: true } };
    const uma = migrarRotasFundidas(antes);
    const duas = migrarRotasFundidas(uma);
    expect(duas).toEqual(uma);
    expect(antes["/dp/fopag"]).toEqual({ V: true }); // original intacta
  });

  it("quem via a Folha continua enxergando o hub depois da fusão", () => {
    const matriz = migrarRotasFundidas({ "/dp/fopag": { V: true } });
    expect(podeAcao(matriz, rotaDaMatrizPara("/dp/fopag")!, "V")).toBe(true);
    expect(podeAcao(matriz, rotaDaMatrizPara("/dp/custos/colaborador")!, "V")).toBe(true);
  });
});
