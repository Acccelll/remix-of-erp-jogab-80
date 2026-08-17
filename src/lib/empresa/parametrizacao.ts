/** @module-kind io */
/**
 * PRO-031 · slice-01 — Parametrização por empresa (numerações e logotipo).
 *
 * Escopo mínimo local (sem backend): permite que cada empresa tenha:
 *  - `logoUrl` — usado em cabeçalhos de relatórios/impressões.
 *  - `numeracoes[tipo]` — sequência por tipo de documento (RDO, NF, Medição…)
 *    com `prefixo`, `padding` e `proximo` (próximo número a emitir).
 *
 * Persistência local em `localStorage` sob a chave canônica
 * `gestaobra:empresa:parametrizacao`. O módulo expõe APIs puras + wrappers
 * de leitura/escrita, mantendo `formatarNumero` e `avancarSequencia` puros
 * para permitir teste unitário sem I/O.
 *
 * Fora de escopo (slice-01): UI de configuração, sincronização com backend,
 * numerações compostas (série/subsérie), reset por competência.
 */

import { STORAGE_KEYS } from "@/lib/core/storage/keys";

export type TipoDocumentoNumeravel =
  | "rdo"
  | "medicao"
  | "nota_fiscal"
  | "requisicao"
  | "contrato"
  | "cotacao"
  | "ordem_compra";

export interface NumeracaoConfig {
  prefixo: string;
  padding: number; // ex.: 6 → "000123"
  proximo: number; // próximo número a ser emitido (>= 1)
}

export interface DadosInstitucionaisEmpresa {
  razaoSocial?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  site?: string;
}

export interface EmpresaParametrizacao {
  empresaId: string;
  logoUrl: string | null;
  numeracoes: Partial<Record<TipoDocumentoNumeravel, NumeracaoConfig>>;
  institucional?: DadosInstitucionaisEmpresa;
  atualizadoEm: string;
}

const DEFAULT_PADDING = 6;

export const DEFAULT_NUMERACAO: Readonly<
  Record<TipoDocumentoNumeravel, NumeracaoConfig>
> = Object.freeze({
  rdo: { prefixo: "RDO", padding: DEFAULT_PADDING, proximo: 1 },
  medicao: { prefixo: "MED", padding: DEFAULT_PADDING, proximo: 1 },
  nota_fiscal: { prefixo: "NF", padding: DEFAULT_PADDING, proximo: 1 },
  requisicao: { prefixo: "REQ", padding: DEFAULT_PADDING, proximo: 1 },
  contrato: { prefixo: "CTR", padding: DEFAULT_PADDING, proximo: 1 },
  cotacao: { prefixo: "COT", padding: DEFAULT_PADDING, proximo: 1 },
  ordem_compra: { prefixo: "OC", padding: DEFAULT_PADDING, proximo: 1 },
});

// ---------- Puro ----------

export function formatarNumero(config: NumeracaoConfig, n: number): string {
  const padded = String(Math.max(1, Math.floor(n))).padStart(
    Math.max(1, config.padding),
    "0",
  );
  return config.prefixo ? `${config.prefixo}-${padded}` : padded;
}

/**
 * Retorna a config com `proximo` incrementado e o número emitido no formato final.
 * Puro — não persiste. Use `emitirNumero` para persistência.
 */
export function avancarSequencia(
  config: NumeracaoConfig,
): { config: NumeracaoConfig; numero: string; emitido: number } {
  const emitido = Math.max(1, Math.floor(config.proximo || 1));
  const proxConfig: NumeracaoConfig = { ...config, proximo: emitido + 1 };
  return { config: proxConfig, numero: formatarNumero(config, emitido), emitido };
}

export function paramVazia(empresaId: string): EmpresaParametrizacao {
  return {
    empresaId,
    logoUrl: null,
    numeracoes: {},
    atualizadoEm: new Date(0).toISOString(),
  };
}

export function resolverConfig(
  param: EmpresaParametrizacao,
  tipo: TipoDocumentoNumeravel,
): NumeracaoConfig {
  return param.numeracoes[tipo] ?? { ...DEFAULT_NUMERACAO[tipo] };
}

// ---------- Persistência (localStorage) ----------

const STORAGE_KEY = STORAGE_KEYS.empresaParametrizacao;

function readAll(): Record<string, EmpresaParametrizacao> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, EmpresaParametrizacao>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / privacy — ignora, camada local best-effort */
  }
}

export const empresaParametrizacaoRepo = {
  get(empresaId: string): EmpresaParametrizacao {
    const map = readAll();
    return map[empresaId] ?? paramVazia(empresaId);
  },
  save(param: EmpresaParametrizacao): EmpresaParametrizacao {
    const map = readAll();
    const next: EmpresaParametrizacao = {
      ...param,
      atualizadoEm: new Date().toISOString(),
    };
    map[param.empresaId] = next;
    writeAll(map);
    return next;
  },
  setLogo(empresaId: string, logoUrl: string | null): EmpresaParametrizacao {
    const atual = this.get(empresaId);
    return this.save({ ...atual, logoUrl });
  },
  setNumeracao(
    empresaId: string,
    tipo: TipoDocumentoNumeravel,
    config: NumeracaoConfig,
  ): EmpresaParametrizacao {
    const atual = this.get(empresaId);
    return this.save({
      ...atual,
      numeracoes: { ...atual.numeracoes, [tipo]: config },
    });
  },
  setInstitucional(
    empresaId: string,
    dados: DadosInstitucionaisEmpresa,
  ): EmpresaParametrizacao {
    const atual = this.get(empresaId);
    return this.save({ ...atual, institucional: dados });
  },
  /**
   * Emite o próximo número para (empresa, tipo), persistindo o incremento.
   * Idempotência: cada chamada avança a sequência — chamadores devem
   * chamar apenas quando o documento for realmente criado.
   */
  emitirNumero(
    empresaId: string,
    tipo: TipoDocumentoNumeravel,
  ): { numero: string; emitido: number } {
    const atual = this.get(empresaId);
    const config = resolverConfig(atual, tipo);
    const { config: proxConfig, numero, emitido } = avancarSequencia(config);
    this.save({
      ...atual,
      numeracoes: { ...atual.numeracoes, [tipo]: proxConfig },
    });
    return { numero, emitido };
  },
};

/**
 * Devolve linhas curtas para cabeçalho institucional (PDF/impressão).
 * Combina os dados salvos em `institucional` (pode ser vazio) e um fallback
 * opcional (ex.: `empresas.razao_social` do backend). Sempre retorna array,
 * já filtrado — chamador só precisa iterar.
 */
export function getInstitucionalHeaderLines(
  empresaId: string | null | undefined,
  fallback?: Partial<DadosInstitucionaisEmpresa>,
): string[] {
  const inst = empresaId
    ? (empresaParametrizacaoRepo.get(empresaId).institucional ?? {})
    : {};
  const merge = (k: keyof DadosInstitucionaisEmpresa) =>
    inst[k] || fallback?.[k] || undefined;
  const linha1 = [merge("razaoSocial"), merge("cnpj") ? `CNPJ ${merge("cnpj")}` : null]
    .filter(Boolean)
    .join(" · ");
  const linha2 = [merge("endereco"), merge("telefone"), merge("email"), merge("site")]
    .filter(Boolean)
    .join(" · ");
  return [linha1, linha2].filter((s) => s && s.length > 0) as string[];
}
