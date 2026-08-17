/** @module-kind pure */
// Regras de vínculo das linhas de ponto: pessoa → colaborador, departamento → obra.
//
// Extraídas de `pontoRepo.ts`, onde estavam misturadas com as chamadas de
// repositório. O motivo é a sincronização automática (`scripts/sync-rhid.ts`),
// que roda fora do navegador e precisa das mesmas regras — duplicá-las lá
// significaria que o cron e a tela poderiam divergir em silêncio.

import { extrairCodigoNumerico, isCentroIndireto } from "@/lib/dp/codigos";

export interface ColaboradorParaVinculo {
  id: string;
  nome: string;
  cpf?: string | null;
  matricula?: string | null;
}

export interface ObraParaVinculo {
  id: string;
  nome: string;
  codigo?: string | null;
}

/** Linha de ponto, na forma mínima que o vínculo precisa. */
export interface LinhaParaVinculo {
  nome: string;
  cpf?: string;
  matricula?: string;
  departamento?: string;
}

export function normalizaNome(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const soDigitos = (v: string | null | undefined) => (v ? String(v).replace(/\D/g, "") : "");

/**
 * Chave que identifica a linha no mapa de colaboradores.
 * Combina os três identificadores porque a mesma pessoa pode aparecer com
 * matrícula em um arquivo e só nome em outro.
 */
export function chaveLinha(r: LinhaParaVinculo): string {
  return `${r.matricula || ""}|${r.cpf || ""}|${r.nome}`;
}

/** Índices de busca do cadastro, montados uma vez por importação. */
export function indexarColaboradores(colaboradores: readonly ColaboradorParaVinculo[]) {
  const porCpf = new Map<string, string>();
  const porMatricula = new Map<string, string>();
  const porNome = new Map<string, string>();
  for (const c of colaboradores) {
    if (!c.id || String(c.id).trim() === "") continue;
    const cpf = soDigitos(c.cpf);
    if (cpf) porCpf.set(cpf, c.id);
    const matricula = soDigitos(c.matricula);
    if (matricula) porMatricula.set(matricula, c.id);
    if (c.nome) porNome.set(normalizaNome(c.nome), c.id);
  }
  return { porCpf, porMatricula, porNome };
}

/**
 * Resolve o colaborador de cada linha. O CPF é o pivô — matrícula e nome são
 * fallback, nessa ordem, porque nome colide e matrícula muda de formato entre
 * as origens.
 */
export function resolverColaboradores(
  linhas: readonly LinhaParaVinculo[],
  colaboradores: readonly ColaboradorParaVinculo[],
): Map<string, string> {
  const mapa = new Map<string, string>();
  if (colaboradores.length === 0) return mapa;
  const { porCpf, porMatricula, porNome } = indexarColaboradores(colaboradores);

  for (const r of linhas) {
    const chave = chaveLinha(r);
    if (mapa.has(chave)) continue;
    let id: string | undefined;
    if (r.cpf) id = porCpf.get(soDigitos(r.cpf));
    if (!id && r.matricula) id = porMatricula.get(soDigitos(r.matricula));
    if (!id) id = porNome.get(normalizaNome(r.nome));
    if (id) mapa.set(chave, id);
  }
  return mapa;
}

export interface ResolucaoObras {
  obraMap: Map<string, string>;
  indiretoMap: Map<string, boolean>;
}

/**
 * Resolve a obra pelo nome do departamento.
 *
 * `overrides` (tabela `ponto_departamento_obra`) tem precedência: é a correção
 * manual feita na Conciliação de Cadastro. Sem override, casa o último grupo de
 * 3-4 dígitos do departamento (`210 - COPI`) com o código da obra
 * (`01.002.0210`). Centros indiretos (ADM/Barracão) ficam sem obra.
 */
export function resolverObras(
  linhas: readonly LinhaParaVinculo[],
  obras: readonly ObraParaVinculo[],
  overrides: ReadonlyMap<string, { obraId: string | null; indireto: boolean }> = new Map(),
): ResolucaoObras {
  const obraMap = new Map<string, string>();
  const indiretoMap = new Map<string, boolean>();

  const porCodigo = new Map<string, string>();
  for (const o of obras) {
    const cod = extrairCodigoNumerico(o.codigo);
    if (cod) porCodigo.set(cod, o.id);
  }

  const vistos = new Set<string>();
  for (const r of linhas) {
    if (!r.departamento || vistos.has(r.departamento)) continue;
    vistos.add(r.departamento);

    const manual = overrides.get(r.departamento);
    if (manual) {
      if (manual.indireto) indiretoMap.set(r.departamento, true);
      else if (manual.obraId) obraMap.set(r.departamento, manual.obraId);
      continue;
    }

    if (isCentroIndireto(r.departamento)) {
      indiretoMap.set(r.departamento, true);
      continue;
    }
    const cod = extrairCodigoNumerico(r.departamento);
    const obraId = cod ? porCodigo.get(cod) : undefined;
    if (obraId) obraMap.set(r.departamento, obraId);
  }

  return { obraMap, indiretoMap };
}
