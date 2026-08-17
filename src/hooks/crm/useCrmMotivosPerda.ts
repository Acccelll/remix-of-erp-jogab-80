// PRO-001 — Motivos de perda no CRM.
// Persistência no MySQL via api.php (rotas crmMotivosPerda/crmPerdas),
// com reconciliação única do legado localStorage. Registra inteligência
// comercial quando uma oportunidade entra em `fechado_perdido`.
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import { STORAGE_KEYS, makeStorageKey } from "@/lib/core/storage/keys";

export const CRM_ESTAGIO_FECHADO_PERDIDO = "fechado_perdido";

export interface CrmMotivoPerdaOpcao {
  id: string;
  rotulo: string;
  ativo: boolean;
  criadoEm?: string;
}

export interface CrmPerdaRegistro {
  oportunidadeId: string;
  motivoId: string;
  motivoRotulo: string;
  observacao?: string;
  registradoEm: string;
  registradoPor?: string;
}

export const MOTIVOS_PERDA_PADRAO: CrmMotivoPerdaOpcao[] = [
  { id: "preco", rotulo: "Preço/condição comercial", ativo: true },
  { id: "prazo", rotulo: "Prazo de execução", ativo: true },
  { id: "concorrente", rotulo: "Concorrente vencedor", ativo: true },
  { id: "escopo", rotulo: "Escopo fora do perfil", ativo: true },
  { id: "sem_retorno", rotulo: "Cliente sem retorno", ativo: true },
  { id: "cancelado", rotulo: "Projeto cancelado", ativo: true },
];

const QK_MOTIVOS = queryKey("crm_motivos_perda");
const QK_PERDAS = queryKey("crm_perdas");
const RECONCILED_FLAG = makeStorageKey("crm", "motivosPerda:reconciliadoEm");

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function slugMotivo(rotulo: string): string {
  const slug = rotulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 42);
  return slug || `motivo_${Date.now()}`;
}

function motivoFromApi(r: any): CrmMotivoPerdaOpcao {
  return {
    id: String(r.id),
    rotulo: r.rotulo ?? "",
    ativo: !!r.ativo,
    criadoEm: r.criado_em ?? undefined,
  };
}

function perdaFromApi(r: any): CrmPerdaRegistro {
  return {
    oportunidadeId: String(r.oportunidade_id),
    motivoId: String(r.motivo_id),
    motivoRotulo: r.motivo_rotulo ?? "",
    observacao: r.observacao ?? undefined,
    registradoEm: r.registrado_em,
    registradoPor: r.registrado_por ?? undefined,
  };
}

function perdaToApi(p: CrmPerdaRegistro) {
  return {
    oportunidade_id: p.oportunidadeId,
    motivo_id: p.motivoId,
    motivo_rotulo: p.motivoRotulo,
    observacao: p.observacao ?? null,
    registrado_em: p.registradoEm,
    registrado_por: p.registradoPor ?? null,
  };
}

/** Empurra motivos custom e perdas legados do localStorage (uma vez por navegador). */
async function reconciliarLegado(): Promise<void> {
  if (localStorage.getItem(RECONCILED_FLAG)) return;
  const motivos = safeParse<CrmMotivoPerdaOpcao[]>(
    localStorage.getItem(STORAGE_KEYS.crmMotivosPerda),
    [],
  );
  const custom = (Array.isArray(motivos) ? motivos : []).filter(
    (m) => !MOTIVOS_PERDA_PADRAO.some((p) => p.id === m.id),
  );
  if (custom.length > 0) {
    await apiFetch("crmMotivosPerda", {
      method: "POST",
      body: {
        rows: custom.map((m) => ({
          id: m.id,
          rotulo: m.rotulo,
          ativo: m.ativo,
          criado_em: m.criadoEm ?? null,
        })),
      },
    });
  }
  const perdas = safeParse<CrmPerdaRegistro[]>(localStorage.getItem(STORAGE_KEYS.crmPerdas), []);
  if (Array.isArray(perdas) && perdas.length > 0) {
    await apiFetch("crmPerdas", { method: "POST", body: { rows: perdas.map(perdaToApi) } });
    localStorage.setItem(STORAGE_KEYS.crmPerdas, JSON.stringify([]));
  }
  localStorage.setItem(RECONCILED_FLAG, new Date().toISOString());
}

export function useCrmMotivosPerda() {
  const qc = useQueryClient();

  const motivosQuery = useQuery({
    queryKey: QK_MOTIVOS,
    queryFn: async (): Promise<CrmMotivoPerdaOpcao[]> => {
      try {
        await reconciliarLegado();
      } catch {
        /* tenta na próxima sessão */
      }
      const data = await apiFetch<any[]>("crmMotivosPerda");
      const rows = (Array.isArray(data) ? data : []).map(motivoFromApi);
      // Tabela vazia (migração ainda não aplicada): degrada para o catálogo padrão.
      return rows.length > 0 ? rows : MOTIVOS_PERDA_PADRAO;
    },
    staleTime: 60_000,
  });

  const perdasQuery = useQuery({
    queryKey: QK_PERDAS,
    queryFn: async (): Promise<CrmPerdaRegistro[]> => {
      const data = await apiFetch<any[]>("crmPerdas");
      return (Array.isArray(data) ? data : []).map(perdaFromApi);
    },
    staleTime: 30_000,
  });

  const motivos = motivosQuery.data ?? MOTIVOS_PERDA_PADRAO;
  const perdas = perdasQuery.data ?? [];

  const salvarMotivoMut = useMutation({
    mutationFn: (m: CrmMotivoPerdaOpcao) =>
      apiFetch("crmMotivosPerda", {
        method: "POST",
        body: { id: m.id, rotulo: m.rotulo, ativo: m.ativo, criado_em: m.criadoEm ?? null },
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: QK_MOTIVOS }),
  });

  const salvarPerdaMut = useMutation({
    mutationFn: (p: CrmPerdaRegistro) =>
      apiFetch("crmPerdas", { method: "POST", body: perdaToApi(p) }),
    onSettled: () => qc.invalidateQueries({ queryKey: QK_PERDAS }),
  });

  const perdasPorOportunidade = useMemo(() => {
    const map = new Map<string, CrmPerdaRegistro>();
    perdas.forEach((p) => map.set(p.oportunidadeId, p));
    return map;
  }, [perdas]);

  const getRegistro = useCallback(
    (oportunidadeId?: string | null) =>
      oportunidadeId ? perdasPorOportunidade.get(oportunidadeId) : undefined,
    [perdasPorOportunidade],
  );

  const adicionarMotivo = useCallback(
    (rotulo: string): CrmMotivoPerdaOpcao => {
      const clean = rotulo.trim();
      const atuais = qc.getQueryData<CrmMotivoPerdaOpcao[]>(QK_MOTIVOS) ?? motivos;
      const existente = atuais.find((m) => m.rotulo.toLowerCase() === clean.toLowerCase());
      if (existente) return existente;
      const baseId = slugMotivo(clean);
      const id = atuais.some((m) => m.id === baseId) ? `${baseId}_${Date.now()}` : baseId;
      const novo = { id, rotulo: clean, ativo: true, criadoEm: new Date().toISOString() };
      qc.setQueryData<CrmMotivoPerdaOpcao[]>(QK_MOTIVOS, (prev) => [...(prev ?? []), novo]);
      salvarMotivoMut.mutate(novo);
      return novo;
    },
    [qc, motivos, salvarMotivoMut],
  );

  const registrarPerda = useCallback(
    (registro: Omit<CrmPerdaRegistro, "registradoEm">) => {
      const nova: CrmPerdaRegistro = {
        ...registro,
        observacao: registro.observacao?.trim() || undefined,
        registradoEm: new Date().toISOString(),
      };
      qc.setQueryData<CrmPerdaRegistro[]>(QK_PERDAS, (prev) => [
        nova,
        ...(prev ?? []).filter((p) => p.oportunidadeId !== registro.oportunidadeId),
      ]);
      salvarPerdaMut.mutate(nova);
      return nova;
    },
    [qc, salvarPerdaMut],
  );

  return {
    motivos: motivos.filter((m) => m.ativo),
    perdas,
    perdasPorOportunidade,
    getRegistro,
    adicionarMotivo,
    registrarPerda,
  };
}
