/**
 * RDO Tab — Fase 4.4 (MVP funcional, uma tela só).
 *
 * Captura offline-first via `useOfflineRecord`:
 *  - Cada edição persiste no IndexedDB (`drafts`).
 *  - `commit()` enfileira mutações (rdo + filhos) e dispara o orquestrador.
 *  - Fotos vão direto para a `media_queue` ao serem adicionadas, com o
 *    `rdo_fotos.id` casando entre as duas filas (a row é criada com
 *    `storage_path=''` e o uploader preenche depois).
 *  - Unique(obra_id,data) garante 1 RDO por obra/dia → dono único.
 *
 * Pré-carrega colaboradores ativos na obra e atividades do cronograma com
 * rede, para uso posterior sem sinal (cache do React Query).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CloudOff,
  Cloud,
  CheckCircle2,
  Loader2,
  Camera,
  Trash2,
  Plus,
  Users,
  Lock,
  PenLine,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";
import type { PeriodoAlocacao } from "@/types";
import { obrasRepo } from "@/lib/repositories/obras";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOfflineRecord } from "@/lib/offline/useOfflineRecord";
import { enqueueMedia } from "@/lib/offline/media-queue";
import { logger } from "@/lib/core/logger";
import { compressImage } from "@/lib/offline/compress-image";
import type { EnqueueInput } from "@/lib/offline/sync-queue";
import { useObraPermissions } from "@/components/obra/ObraPermissionsContext";
import { useRdoNumeracaoLocal } from "@/hooks/obras/useRdoNumeracaoLocal";
import { SignaturePad, type SignaturePadHandle } from "@/components/qualidade/SignaturePad";
import { exportRdoToPDF } from "@/lib/rdo/export-pdf";
import { empresaParametrizacaoRepo, getInstitucionalHeaderLines } from "@/lib/empresa/parametrizacao";
import type { RdoRegistroLocal } from "@/lib/rdo/numeracao";
import { useAuth } from "@/contexts/auth/useAuth";
import { toast } from "sonner";

type Turno = "manha" | "tarde" | "noite";

interface EfetivoLinha {
  id: string;
  colaborador_id?: string;
  funcao_id?: string;
  quantidade: number;
  presente: boolean;
}

interface AtividadeLinha {
  id: string;
  cronograma_item_id?: string;
  descricao: string;
  quantidade?: number;
}

interface OcorrenciaLinha {
  id: string;
  tipo: "chuva" | "falta_material" | "acidente" | "visita" | "outro";
  descricao: string;
}

interface FotoLinha {
  id: string;
  path: string;
  legenda: string;
  // só presente em memória até o orquestrador subir; depois fica vazio.
  preview?: string;
}

interface RdoData {
  rdo_id: string;
  clima_manha: string;
  clima_tarde: string;
  clima_noite: string;
  trabalhavel_manha: boolean;
  trabalhavel_tarde: boolean;
  trabalhavel_noite: boolean;
  observacoes: string;
  efetivo: EfetivoLinha[];
  atividades: AtividadeLinha[];
  ocorrencias: OcorrenciaLinha[];
  fotos: FotoLinha[];
}

function emptyData(): RdoData {
  return {
    rdo_id: crypto.randomUUID(),
    clima_manha: "",
    clima_tarde: "",
    clima_noite: "",
    trabalhavel_manha: true,
    trabalhavel_tarde: true,
    trabalhavel_noite: true,
    observacoes: "",
    efetivo: [],
    atividades: [],
    ocorrencias: [],
    fotos: [],
  };
}

const CLIMA_OPCOES = ["Bom", "Encoberto", "Chuva fraca", "Chuva forte", "Outro"];
const OCORRENCIA_TIPOS: { value: OcorrenciaLinha["tipo"]; label: string }[] = [
  { value: "chuva", label: "Chuva" },
  { value: "falta_material", label: "Falta de material" },
  { value: "acidente", label: "Acidente" },
  { value: "visita", label: "Visita" },
  { value: "outro", label: "Outro" },
];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler assinatura."));
    reader.readAsDataURL(blob);
  });
}

async function sha256DataUrl(dataUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(dataUrl);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function RdoTab({ obraId }: { obraId: string }) {
  const { canEdit: canEditFromCtx } = useObraPermissions();
  const { currentPlayer } = useAuth();
  const [dataDia, setDataDia] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [assinaturaOpen, setAssinaturaOpen] = useState(false);
  const [assinanteNome, setAssinanteNome] = useState("");
  const [assinando, setAssinando] = useState(false);
  const sigRef = useRef<SignaturePadHandle | null>(null);
  const key = `rdo:${obraId}:${dataDia}`;
  const { registrar, assinarEFechar, obter } = useRdoNumeracaoLocal();

  const { data: obraInfo } = useQuery({
    queryKey: ["rdo-obra", obraId],
    queryFn: () => obrasRepo.getResumoRdo(obraId),
    enabled: !!obraId,
    staleTime: 5 * 60 * 1000,
  });


  // Colaboradores mobilizados na obra na DATA do RDO (não somente ativos hoje).
  // Regra: mobilização vigente em `dataDia` = data_inicio <= dataDia AND (data_fim IS NULL OR data_fim >= dataDia).
  const { data: colaboradores = [] } = useQuery({
    queryKey: ["rdo-colabs", obraId, dataDia],
    queryFn: async () => {
      // Fonte: rota `mobilizacoesPeriodos` (MySQL). A tabela homônima no
      // Supabase não recebe escrita — as mobilizações vão todas para o MySQL.
      const periodos = await api.getAll<PeriodoAlocacao>("mobilizacoesPeriodos", { to: dataDia });
      const porColaborador = new Map<string, string>();
      (Array.isArray(periodos) ? periodos : [])
        // Só períodos DE OBRA: quem estava de férias, folga ou afastado naquele
        // dia não é presença no RDO, ainda que a lista traga o período dele.
        .filter((p) => p.tipo === "obra" && String(p.obra_id) === String(obraId))
        .filter((p) => p.data_inicio <= dataDia && (!p.data_fim || p.data_fim >= dataDia))
        .forEach((p) => {
          porColaborador.set(String(p.colaborador_id), p.colaborador_nome || "");
        });
      return Array.from(porColaborador.entries()).map(([id, nome]) => ({ id, nome }));
    },
    staleTime: 5 * 60 * 1000,
  });


  // Atividades do cronograma para vincular.
  const { data: atividadesCron = [] } = useQuery({
    queryKey: ["rdo-cron", obraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cronograma_itens")
        .select("id, descricao, ordem")
        .eq("obra_id", obraId)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(500);
      return (data ?? []) as { id: string; descricao: string; ordem: number }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Carrega RDO já existente do dia (se houver) — depois entra como rascunho local.
  const { data: rdoExistente } = useQuery({
    queryKey: ["rdo-existente", obraId, dataDia],
    queryFn: async () => {
      const { data } = await supabase
        .from("rdo")
        .select(
          "id, numero_documental, fechado_em, fechado_por, assinado_em, assinado_por, assinatura_sha256",
        )
        .eq("obra_id", obraId)
        .eq("data", dataDia)
        .maybeSingle();
      return data as {
        id: string;
        numero_documental: string | null;
        fechado_em: string | null;
        fechado_por: string | null;
        assinado_em: string | null;
        assinado_por: string | null;
        assinatura_sha256: string | null;
      } | null;
    },
  });

  const toMutations = useMemo(
    () =>
      (d: RdoData): EnqueueInput[] => {
        const ops: EnqueueInput[] = [];
        ops.push({
          id: d.rdo_id,
          table: "rdo",
          payload: {
            id: d.rdo_id,
            obra_id: obraId,
            data: dataDia,
            clima_manha: d.clima_manha || null,
            clima_tarde: d.clima_tarde || null,
            clima_noite: d.clima_noite || null,
            trabalhavel_manha: d.trabalhavel_manha,
            trabalhavel_tarde: d.trabalhavel_tarde,
            trabalhavel_noite: d.trabalhavel_noite,
            observacoes: d.observacoes,
            status: "sincronizado",
            synced_at: new Date().toISOString(),
          },
          onConflict: "obra_id,data",
        });
        for (const e of d.efetivo) {
          ops.push({
            id: e.id,
            table: "rdo_efetivo",
            payload: {
              id: e.id,
              rdo_id: d.rdo_id,
              colaborador_id: e.colaborador_id ?? null,
              funcao_id: e.funcao_id ?? null,
              quantidade: e.quantidade,
              presente: e.presente,
            },
          });
        }
        for (const a of d.atividades) {
          ops.push({
            id: a.id,
            table: "rdo_atividades",
            payload: {
              id: a.id,
              rdo_id: d.rdo_id,
              cronograma_item_id: a.cronograma_item_id ?? null,
              descricao: a.descricao,
              quantidade: a.quantidade ?? null,
            },
          });
        }
        for (const o of d.ocorrencias) {
          ops.push({
            id: o.id,
            table: "rdo_ocorrencias",
            payload: {
              id: o.id,
              rdo_id: d.rdo_id,
              tipo: o.tipo,
              descricao: o.descricao,
            },
          });
        }
        for (const f of d.fotos) {
          ops.push({
            id: f.id,
            table: "rdo_fotos",
            payload: {
              id: f.id,
              rdo_id: d.rdo_id,
              storage_path: f.path, // uploader vai sobrescrever depois do upload
              legenda: f.legenda,
            },
          });
        }
        return ops;
      },
    [obraId, dataDia],
  );

  const { data, setData, status, online, hydrated, commit, syncing } = useOfflineRecord<RdoData>({
    key,
    initial: emptyData(),
    toMutations,
  });

  // Se o servidor já tem o RDO desse dia e o draft ainda não foi carregado
  // com aquele id, sugere usar o id remoto para o upsert acertar a linha.
  useEffect(() => {
    if (!hydrated || !rdoExistente) return;
    if (data.rdo_id !== rdoExistente.id) {
      setData((prev) => ({ ...prev, rdo_id: rdoExistente.id }));
    }
  }, [hydrated, rdoExistente, data.rdo_id, setData]);

  // PRO-005 · slice-02 — registra número local e aplica trava de edição.
  const registroLocal = obter(data.rdo_id);
  const rdoFechado = !!registroLocal?.fechado || !!rdoExistente?.fechado_em;
  const canEdit = canEditFromCtx && !rdoFechado;
  const registroDocumento: RdoRegistroLocal | undefined = registroLocal
    ? {
        ...registroLocal,
        numero: rdoExistente?.numero_documental ?? registroLocal.numero,
        fechado: rdoFechado,
        fechadoEm: rdoExistente?.fechado_em ?? registroLocal.fechadoEm,
        fechadoPor: rdoExistente?.fechado_por ?? registroLocal.fechadoPor,
        assinadoEm: rdoExistente?.assinado_em ?? registroLocal.assinadoEm,
        assinadoPor: rdoExistente?.assinado_por ?? registroLocal.assinadoPor,
      }
    : rdoExistente?.numero_documental
      ? {
          id: rdoExistente.id,
          obraId,
          empresaId: obraInfo?.empresa_id ?? undefined,
          ano: new Date(`${dataDia}T00:00:00`).getFullYear(),
          sequencial: Number(rdoExistente.numero_documental.split("-").at(-1) ?? 0),
          numero: rdoExistente.numero_documental,
          fechado: !!rdoExistente.fechado_em,
          fechadoEm: rdoExistente.fechado_em ?? undefined,
          fechadoPor: rdoExistente.fechado_por ?? undefined,
          assinadoEm: rdoExistente.assinado_em ?? undefined,
          assinadoPor: rdoExistente.assinado_por ?? undefined,
        }
      : undefined;
  const colaboradoresPorId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c.nome])),
    [colaboradores],
  );
  const atividadesPorId = useMemo(
    () => new Map(atividadesCron.map((a) => [a.id, a.descricao])),
    [atividadesCron],
  );

  useEffect(() => {
    if (!hydrated || !data.rdo_id) return;
    if (!obraInfo) return;
    if (!obter(data.rdo_id)) {
      registrar({ id: data.rdo_id, obraId, empresaId: obraInfo.empresa_id, data: dataDia });
    }
  }, [hydrated, data.rdo_id, obraId, obraInfo, dataDia, registrar, obter]);

  function handleAbrirAssinatura() {
    setAssinanteNome(currentPlayer?.login ?? "");
    setAssinaturaOpen(true);
  }

  async function sincronizarRdoAgora() {
    const mutations = toMutations(data);
    for (const m of mutations) {
      const table = (supabase.from as any)(m.table);
      const { error } = await table.upsert(m.payload, { onConflict: m.onConflict ?? "id" });
      if (error) throw error;
    }
  }

  async function handleAssinarEFechar() {
    if (sigRef.current?.isEmpty()) {
      toast.error("Assine antes de fechar o RDO.");
      return;
    }
    if (!assinanteNome.trim()) {
      toast.error("Informe o nome do responsável.");
      return;
    }
    setAssinando(true);
    try {
      const blob = await sigRef.current!.toBlob();
      if (!blob) throw new Error("Falha ao gerar assinatura.");
      const assinaturaDataUrl = await blobToDataUrl(blob);
      if (online) {
        await sincronizarRdoAgora();
        const { error } = await (supabase.rpc as any)("rdo_fechar_assinar", {
          p_rdo_id: data.rdo_id,
          p_numero_documental: registroLocal?.numero ?? rdoExistente?.numero_documental ?? "",
          p_assinado_por: assinanteNome.trim(),
          p_assinatura_sha256: await sha256DataUrl(assinaturaDataUrl),
        });
        if (error) throw error;
      }
      const res = assinarEFechar(data.rdo_id, { assinadoPor: assinanteNome, assinaturaDataUrl });
      if (res.erro) throw new Error(res.erro);
      setAssinaturaOpen(false);
      toast.success(online ? "RDO assinado, fechado e auditado." : "RDO assinado e fechado localmente.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao assinar RDO.";
      toast.error(msg);
    } finally {
      setAssinando(false);
    }
  }

  function handleExportarPdf() {
    if (!registroDocumento) return;
    if (!registroDocumento.fechado) {
      toast.error("Feche o RDO antes de exportar o PDF.");
      return;
    }
    // PRO-031.slice-04 — logotipo da empresa vinculada à obra (fallback silencioso).
    const empresaId = obraInfo?.empresa_id ?? undefined;
    const logoDataUrl = empresaId
      ? empresaParametrizacaoRepo.get(empresaId).logoUrl ?? undefined
      : undefined;
    const institucionalLines = getInstitucionalHeaderLines(empresaId);
    exportRdoToPDF({
      registro: registroDocumento,
      dataDia,
      data,
      obraNome: obraInfo?.nome,
      colaboradorNome: (id) => colaboradoresPorId.get(id),
      atividadeNome: (id) => atividadesPorId.get(id),
      logoDataUrl,
      institucionalLines,
    });
    toast.success("PDF do RDO gerado.");
  }

  async function addFoto(file: File) {
    if (!canEdit) return;

    const fotoId = crypto.randomUUID();
    // OFF.1 — comprime antes de enfileirar (máx ~1600px, JPEG q≈0.72).
    // Em caso de falha/imagem pequena, devolve o blob original sem bloquear.
    const blob = await compressImage(file);
    // Sempre grava como .jpg quando comprimimos para JPEG; mantém ext original caso contrário.
    const ext =
      blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${data.rdo_id}/${fotoId}.${ext}`;
    const preview = URL.createObjectURL(blob);

    await enqueueMedia({
      id: fotoId,
      bucket: "rdo-fotos",
      path,
      blob,
      contentType: blob.type || "image/jpeg",
      parentTable: "rdo_fotos",
      parentId: fotoId,
      parentColumn: "storage_path",
    });

    setData((prev) => ({
      ...prev,
      fotos: [...prev.fotos, { id: fotoId, path, legenda: "", preview }],
    }));
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando rascunho local…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label htmlFor="rdo-data">Data do diário</Label>
            <Input
              id="rdo-data"
              type="date"
              value={dataDia}
              onChange={(e) => setDataDia(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {format(new Date(`${dataDia}T00:00:00`), "EEEE, dd 'de' MMMM 'de' yyyy", {
              locale: ptBR,
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {registroDocumento && (
            <Badge variant={rdoFechado ? "secondary" : "outline"} className="font-mono">
              {rdoFechado && <Lock className="h-3 w-3 mr-1" />}
              {registroDocumento.numero}
            </Badge>
          )}
          {(registroDocumento?.assinaturaDataUrl || rdoExistente?.assinatura_sha256) && (
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> Assinado
            </Badge>
          )}
          <StatusBadge online={online} status={status} syncing={syncing} />
          <Button onClick={() => void commit()} disabled={syncing || !canEdit}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar e sincronizar
          </Button>
          {registroDocumento && rdoFechado && (
            <Button variant="outline" onClick={handleExportarPdf}>
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
          )}
          {registroDocumento && !rdoFechado && canEditFromCtx && (
            <Button variant="outline" onClick={handleAbrirAssinatura} disabled={syncing}>
              <PenLine className="h-4 w-4 mr-2" /> Assinar e fechar
            </Button>
          )}
        </div>
      </div>

      <Dialog open={assinaturaOpen} onOpenChange={(open) => !assinando && setAssinaturaOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-4 w-4" /> Assinatura do RDO
            </DialogTitle>
            <DialogDescription>
              A assinatura fecha o RDO e bloqueia novas edições locais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Responsável</Label>
              <Input
                value={assinanteNome}
                onChange={(e) => setAssinanteNome(e.target.value)}
                placeholder="Nome completo"
                disabled={assinando}
              />
            </div>
            <SignaturePad ref={sigRef} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAssinaturaOpen(false)} disabled={assinando}>
              Cancelar
            </Button>
            <Button onClick={() => void handleAssinarEFechar()} disabled={assinando}>
              {assinando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clima do dia</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {(["manha", "tarde", "noite"] as Turno[]).map((t) => (
            <ClimaBloco
              key={t}
              turno={t}
              clima={data[`clima_${t}` as const]}
              trabalhavel={data[`trabalhavel_${t}` as const]}
              disabled={!canEdit}
              onClima={(v) => setData((p) => ({ ...p, [`clima_${t}`]: v }))}
              onTrabalhavel={(v) => setData((p) => ({ ...p, [`trabalhavel_${t}`]: v }))}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Efetivo</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!canEdit || colaboradores.length === 0}
              title="PRO-006 · Preenche o efetivo com os colaboradores mobilizados na obra hoje"
              onClick={() => {
                setData((p) => {
                  const jaListados = new Set(
                    p.efetivo.map((e) => e.colaborador_id).filter(Boolean),
                  );
                  const novos = colaboradores
                    .filter((c) => !jaListados.has(c.id))
                    .map((c) => ({
                      id: crypto.randomUUID(),
                      colaborador_id: c.id,
                      quantidade: 1,
                      presente: true,
                    }));
                  return { ...p, efetivo: [...p.efetivo, ...novos] };
                });
              }}
            >
              <Users className="h-4 w-4 mr-1" /> Carregar do Board
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canEdit}
              onClick={() =>
                setData((p) => ({
                  ...p,
                  efetivo: [...p.efetivo, { id: crypto.randomUUID(), quantidade: 1, presente: true }],
                }))
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Linha
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.efetivo.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma linha. Use “Linha” para adicionar colaborador ou função.
            </p>
          )}
          {data.efetivo.map((e, i) => (
            <div key={e.id} className="grid gap-2 md:grid-cols-[1fr_120px_100px_40px] items-end">
              <div>
                <Label className="text-xs">Colaborador</Label>
                <Select
                  value={e.colaborador_id ?? ""}
                  disabled={!canEdit}
                  onValueChange={(v) =>
                    setData((p) => ({
                      ...p,
                      efetivo: p.efetivo.map((x, j) =>
                        j === i ? { ...x, colaborador_id: v || undefined } : x,
                      ),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— por função —" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={e.quantidade}
                  disabled={!canEdit}
                  onChange={(ev) =>
                    setData((p) => ({
                      ...p,
                      efetivo: p.efetivo.map((x, j) =>
                        j === i ? { ...x, quantidade: Number(ev.target.value || 1) } : x,
                      ),
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={e.presente}
                  disabled={!canEdit}
                  onCheckedChange={(v) =>
                    setData((p) => ({
                      ...p,
                      efetivo: p.efetivo.map((x, j) => (j === i ? { ...x, presente: v } : x)),
                    }))
                  }
                />
                <span className="text-xs">{e.presente ? "Presente" : "Ausente"}</span>
              </div>
              <Button
                size="icon"
                aria-label="Remover item"
                variant="ghost"
                disabled={!canEdit}
                onClick={() =>
                  setData((p) => ({ ...p, efetivo: p.efetivo.filter((_, j) => j !== i) }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Atividades executadas</CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={!canEdit}
            onClick={() =>
              setData((p) => ({
                ...p,
                atividades: [...p.atividades, { id: crypto.randomUUID(), descricao: "" }],
              }))
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Linha
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.atividades.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Vincule atividades do cronograma ou descreva livremente.
            </p>
          )}
          {data.atividades.map((a, i) => (
            <div key={a.id} className="grid gap-2 md:grid-cols-[1fr_1fr_100px_40px] items-end">
              <div>
                <Label className="text-xs">Cronograma</Label>
                <Select
                  value={a.cronograma_item_id ?? ""}
                  disabled={!canEdit}
                  onValueChange={(v) =>
                    setData((p) => ({
                      ...p,
                      atividades: p.atividades.map((x, j) =>
                        j === i ? { ...x, cronograma_item_id: v || undefined } : x,
                      ),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— livre —" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {atividadesCron.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Descrição / observação</Label>
                <Input
                  value={a.descricao}
                  disabled={!canEdit}
                  onChange={(ev) =>
                    setData((p) => ({
                      ...p,
                      atividades: p.atividades.map((x, j) =>
                        j === i ? { ...x, descricao: ev.target.value } : x,
                      ),
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={a.quantidade ?? ""}
                  disabled={!canEdit}
                  onChange={(ev) =>
                    setData((p) => ({
                      ...p,
                      atividades: p.atividades.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              quantidade: ev.target.value ? Number(ev.target.value) : undefined,
                            }
                          : x,
                      ),
                    }))
                  }
                />
              </div>
              <Button
                size="icon"
                aria-label="Remover item"
                variant="ghost"
                disabled={!canEdit}
                onClick={() =>
                  setData((p) => ({ ...p, atividades: p.atividades.filter((_, j) => j !== i) }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <CompromissosPpcSugestao
            obraId={obraId}
            dataDia={dataDia}
            cronogramaItemIds={data.atividades
              .map((a) => a.cronograma_item_id)
              .filter((x): x is string => !!x)}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Ocorrências</CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={!canEdit}
            onClick={() =>
              setData((p) => ({
                ...p,
                ocorrencias: [
                  ...p.ocorrencias,
                  { id: crypto.randomUUID(), tipo: "outro", descricao: "" },
                ],
              }))
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Linha
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.ocorrencias.map((o, i) => (
            <div key={o.id} className="grid gap-2 md:grid-cols-[200px_1fr_40px] items-end">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={o.tipo}
                  disabled={!canEdit}
                  onValueChange={(v) =>
                    setData((p) => ({
                      ...p,
                      ocorrencias: p.ocorrencias.map((x, j) =>
                        j === i ? { ...x, tipo: v as OcorrenciaLinha["tipo"] } : x,
                      ),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OCORRENCIA_TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Input
                  value={o.descricao}
                  disabled={!canEdit}
                  onChange={(ev) =>
                    setData((p) => ({
                      ...p,
                      ocorrencias: p.ocorrencias.map((x, j) =>
                        j === i ? { ...x, descricao: ev.target.value } : x,
                      ),
                    }))
                  }
                />
              </div>
              <Button
                size="icon"
                aria-label="Remover item"
                variant="ghost"
                disabled={!canEdit}
                onClick={() =>
                  setData((p) => ({ ...p, ocorrencias: p.ocorrencias.filter((_, j) => j !== i) }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Fotos do dia</CardTitle>
          <label className={canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-60"}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              disabled={!canEdit}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                files.forEach((f) => void addFoto(f));
                e.target.value = "";
              }}
            />
            <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-9 px-3 border border-input bg-background hover:bg-accent">
              <Camera className="h-4 w-4 mr-1.5" /> Adicionar
            </span>
          </label>
        </CardHeader>
        <CardContent>
          {data.fotos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem fotos. O upload acontece em segundo plano ao reconectar.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.fotos.map((f, i) => (
                <div key={f.id} className="space-y-1">
                  {f.preview ? (
                    <img
                      src={f.preview}
                      alt={f.legenda || "Foto do RDO"}
                      className="rounded-md object-cover aspect-square w-full"
                      loading="lazy"
                    />
                  ) : (
                    <div className="rounded-md bg-muted aspect-square w-full grid place-items-center text-xs text-muted-foreground">
                      {f.path.split("/").pop()}
                    </div>
                  )}
                  <Input
                    placeholder="Legenda"
                    value={f.legenda}
                    disabled={!canEdit}
                    onChange={(ev) =>
                      setData((p) => ({
                        ...p,
                        fotos: p.fotos.map((x, j) =>
                          j === i ? { ...x, legenda: ev.target.value } : x,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observações gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={data.observacoes}
            disabled={!canEdit}
            onChange={(e) => setData((p) => ({ ...p, observacoes: e.target.value }))}
            placeholder="Eventos relevantes do dia, decisões, paralisações…"
          />
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Captura offline-first. Tudo é gravado localmente e sincroniza ao reconectar; a regra
        <strong> 1 RDO por obra/dia</strong> garante dono único.
      </p>
    </div>
  );
}

function ClimaBloco({
  turno,
  clima,
  trabalhavel,
  disabled = false,
  onClima,
  onTrabalhavel,
}: {
  turno: Turno;
  clima: string;
  trabalhavel: boolean;
  disabled?: boolean;
  onClima: (v: string) => void;
  onTrabalhavel: (v: boolean) => void;
}) {
  const titulos: Record<Turno, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
  return (
    <div className="space-y-2">
      <Label>{titulos[turno]}</Label>
      <Select value={clima} onValueChange={onClima} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Condição" />
        </SelectTrigger>
        <SelectContent>
          {CLIMA_OPCOES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Switch checked={trabalhavel} onCheckedChange={onTrabalhavel} disabled={disabled} />
        <span className="text-xs text-muted-foreground">
          {trabalhavel ? "Trabalhável" : "Paralisado"}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({
  online,
  status,
  syncing,
}: {
  online: boolean;
  status: "rascunho" | "sincronizando" | "sincronizado";
  syncing: boolean;
}) {
  if (!online) {
    return (
      <Badge variant="outline" className="gap-1">
        <CloudOff className="h-3 w-3" /> Offline
      </Badge>
    );
  }
  if (syncing || status === "sincronizando") {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Sincronizando
      </Badge>
    );
  }
  if (status === "sincronizado") {
    return (
      <Badge variant="outline" className="gap-1 text-success border-success/40">
        <CheckCircle2 className="h-3 w-3" /> Sincronizado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Cloud className="h-3 w-3" /> Rascunho local
    </Badge>
  );
}

/**
 * 5D.3 — Integração RDO ↔ Last Planner.
 */
function CompromissosPpcSugestao({
  obraId,
  dataDia,
  cronogramaItemIds,
  canEdit,
}: {
  obraId: string;
  dataDia: string;
  cronogramaItemIds: string[];
  canEdit: boolean;
}) {
  const [marcando, setMarcando] = useState<string | null>(null);
  const semanaInicio = useMemo(() => {
    const d = new Date(dataDia + "T00:00:00");
    const dia = d.getDay();
    const diff = dia === 0 ? -6 : 1 - dia;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }, [dataDia]);

  const ids = useMemo(() => Array.from(new Set(cronogramaItemIds)), [cronogramaItemIds]);

  const { data: compromissos = [], refetch } = useQuery({
    enabled: ids.length > 0,
    queryKey: ["rdo-ppc-sugestao", obraId, semanaInicio, ids.join(",")],
    queryFn: async () => {
      const { data: pacs } = await supabase
        .from("pacotes_trabalho")
        .select("id, descricao, cronograma_item_id")
        .eq("obra_id", obraId)
        .in("cronograma_item_id", ids);
      const pacotes = (pacs ?? []) as {
        id: string;
        descricao: string;
        cronograma_item_id: string;
      }[];
      if (pacotes.length === 0) return [];
      const { data: cs } = await supabase
        .from("compromissos_semanais")
        .select("id, pacote_id, concluido")
        .eq("obra_id", obraId)
        .eq("semana_inicio", semanaInicio)
        .in(
          "pacote_id",
          pacotes.map((p) => p.id),
        )
        .eq("concluido", false);
      const list = (cs ?? []) as { id: string; pacote_id: string; concluido: boolean }[];
      const pmap = new Map(pacotes.map((p) => [p.id, p.descricao]));
      return list.map((c) => ({ ...c, descricao: pmap.get(c.pacote_id) ?? "—" }));
    },
  });

  if (ids.length === 0 || compromissos.length === 0) return null;

  async function marcar(id: string) {
    if (!canEdit) return;

    setMarcando(id);
    const { error } = await supabase
      .from("compromissos_semanais")
      .update({ concluido: true, concluido_em: new Date().toISOString() })
      .eq("id", id);
    setMarcando(null);
    if (error) {
      logger.error(error);
      return;
    }
    void refetch();
  }

  return (
    <div className="mt-3 rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        Compromissos PPC abertos esta semana ({compromissos.length})
      </div>
      {compromissos.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">{c.descricao}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={marcando === c.id || !canEdit}
            onClick={() => void marcar(c.id)}
          >
            {marcando === c.id ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            )}
            Concluir
          </Button>
        </div>
      ))}
    </div>
  );
}
