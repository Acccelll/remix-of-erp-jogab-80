/**
 * QR codes para alvos de inspeção (frentes, equipamentos, locais) — INSP.5c
 *
 * - CRUD de `inspecao_qr_alvos`
 * - Geração de QR via lib `qrcode` (PNG dataURL) apontando para
 *   `${origin}/inspecoes/qr/go/:alvoId`, que resolve obra/local/modelo e
 *   redireciona para a captura.
 * - Layout de impressão de etiquetas (window.print) em folha A4.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inspecaoQrAlvosRepo, inspecaoModelosRepo } from "@/lib/repositories/inspecoes";
import { useAuth } from "@/contexts/auth/useAuth";
import { useObrasContext } from "@/contexts/ObrasContext";
import QRCode from "qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCode, Plus, Printer, Trash2 } from "lucide-react";
import { QueryState } from "@/components/common/QueryState";
import { EmptyState } from "@/components/common/EmptyState";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/ui/confirm";

type Tipo = "frente" | "equipamento" | "local" | "outro";

interface AlvoRow {
  id: string;
  obra_id: string;
  tipo: Tipo;
  codigo: string;
  nome: string;
  local: string | null;
  modelo_id: string | null;
  ativa: boolean;
}

interface ModeloRow {
  id: string;
  codigo: string;
  nome: string;
}

const TIPO_LABEL: Record<Tipo, string> = {
  frente: "Frente",
  equipamento: "Equipamento",
  local: "Local",
  outro: "Outro",
};

function qrUrl(alvoId: string) {
  return `${window.location.origin}/inspecoes/qr/go/${alvoId}`;
}

export default function InspecoesQR() {
  const qc = useQueryClient();
  const { currentPlayer } = useAuth();
  const { obras } = useObrasContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AlvoRow | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [filtroObra, setFiltroObra] = useState<string>("all");

  const {
    data: alvos = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["inspecao-qr-alvos"],
    queryFn: async () => {
      return (await inspecaoQrAlvosRepo.list()) as AlvoRow[];
    },
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["inspecao-modelos-min"],
    queryFn: async () => {
      return (await inspecaoModelosRepo.listMin()) as ModeloRow[];
    },
  });

  const obraMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const modeloMap = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos]);

  const alvosFiltrados = useMemo(
    () => (filtroObra === "all" ? alvos : alvos.filter((a) => a.obra_id === filtroObra)),
    [alvos, filtroObra],
  );

  const upsert = useMutation({
    mutationFn: async (
      row: Partial<AlvoRow> & { obra_id: string; codigo: string; nome: string; tipo: Tipo },
    ) => {
      if (editing?.id) {
        await inspecaoQrAlvosRepo.update(editing.id, row);
      } else {
        await inspecaoQrAlvosRepo.insert({ ...row, created_by: currentPlayer?.id ?? null });
      }
    },
    onSuccess: () => {
      toast.success("Alvo salvo.");
      setDialogOpen(false);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["inspecao-qr-alvos"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await inspecaoQrAlvosRepo.remove(id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inspecao-qr-alvos"] });
      toast.success("Alvo removido.");
    },
  });

  function toggleSelecionado(id: string) {
    setSelecionados((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6" /> QR Codes de Inspeção
          </h1>
          <p className="text-sm text-muted-foreground">
            Etiquetas reutilizáveis para frentes, equipamentos e locais.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filtroObra} onValueChange={setFiltroObra}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obras</SelectItem>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={selecionados.size === 0}
            className="gap-1"
          >
            <Printer className="h-4 w-4" /> Imprimir ({selecionados.size})
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="gap-1"
          >
            <Plus className="h-4 w-4" /> Novo alvo
          </Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-0">
          <QueryState
            isLoading={isLoading}
            isError={isError}
            error={error}
            data={alvosFiltrados}
            isEmpty={(d) => d.length === 0}
            onRetry={() => refetch()}
            empty={
              <EmptyState
                icon={QrCode}
                title="Nenhum alvo cadastrado"
                description="Crie o primeiro alvo para imprimir etiquetas QR."
              />
            }
          >
            {(list) => (
              <div className="divide-y">
                {list.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer"
                    onClick={() => toggleSelecionado(a.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selecionados.has(a.id)}
                      onChange={() => toggleSelecionado(a.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{a.codigo}</Badge>
                        <Badge variant="secondary">{TIPO_LABEL[a.tipo]}</Badge>
                        <span className="font-medium truncate">{a.nome}</span>
                        {!a.ativa && <Badge variant="outline">Pausado</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                        <span>{obraMap.get(a.obra_id) ?? "—"}</span>
                        {a.local && <span>· {a.local}</span>}
                        {a.modelo_id && (
                          <span>· modelo {modeloMap.get(a.modelo_id)?.codigo ?? "—"}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(a);
                        setDialogOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="icon"
                      aria-label="Excluir QR"
                      variant="ghost"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (
                          await confirmDialog({
                            title: "Remover alvo?",
                            description: "Os QRs impressos deixarão de funcionar.",
                          })
                        )
                          remove.mutate(a.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>

      {/* Folha de impressão */}
      <div className="hidden print:grid grid-cols-3 gap-4">
        {alvosFiltrados
          .filter((a) => selecionados.has(a.id))
          .map((a) => (
            <QrCard
              key={a.id}
              alvo={a}
              obraNome={obraMap.get(a.obra_id) ?? ""}
              modeloLabel={a.modelo_id ? (modeloMap.get(a.modelo_id)?.codigo ?? "") : ""}
            />
          ))}
      </div>

      <AlvoDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        modelos={modelos}
        obras={obras.map((o) => ({ id: o.id, nome: o.nome }))}
        onSubmit={(p) => upsert.mutate(p)}
        saving={upsert.isPending}
      />
    </div>
  );
}

function QrCard({
  alvo,
  obraNome,
  modeloLabel,
}: {
  alvo: AlvoRow;
  obraNome: string;
  modeloLabel: string;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(qrUrl(alvo.id), { width: 360, margin: 1 }).then(setDataUrl);
  }, [alvo.id]);
  return (
    <div className="border rounded p-3 text-center break-inside-avoid">
      {dataUrl && <img src={dataUrl} alt="QR" className="mx-auto w-40 h-40" />}
      <div className="mt-2 text-sm font-bold">{alvo.codigo}</div>
      <div className="text-xs">{alvo.nome}</div>
      <div className="text-[10px] text-muted-foreground mt-1">
        {obraNome}
        {alvo.local ? ` · ${alvo.local}` : ""}
        {modeloLabel ? ` · ${modeloLabel}` : ""}
      </div>
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AlvoRow | null;
  modelos: ModeloRow[];
  obras: { id: string; nome: string }[];
  onSubmit: (
    p: Partial<AlvoRow> & { obra_id: string; codigo: string; nome: string; tipo: Tipo },
  ) => void;
  saving: boolean;
}

function AlvoDialog({
  open,
  onOpenChange,
  editing,
  modelos,
  obras,
  onSubmit,
  saving,
}: DialogProps) {
  const [obraId, setObraId] = useState("");
  const [tipo, setTipo] = useState<Tipo>("frente");
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [local, setLocal] = useState("");
  const [modeloId, setModeloId] = useState<string>("");
  const [ativa, setAtiva] = useState(true);
  const [preview, setPreview] = useState<string>("");
  const initRef = useRef<string | null>(null);

  useEffect(() => {
    const key = editing?.id ?? "new";
    if (initRef.current === key) return;
    initRef.current = key;
    if (editing) {
      setObraId(editing.obra_id);
      setTipo(editing.tipo);
      setCodigo(editing.codigo);
      setNome(editing.nome);
      setLocal(editing.local ?? "");
      setModeloId(editing.modelo_id ?? "");
      setAtiva(editing.ativa);
      QRCode.toDataURL(qrUrl(editing.id), { width: 220, margin: 1 }).then(setPreview);
    } else {
      setObraId("");
      setTipo("frente");
      setCodigo("");
      setNome("");
      setLocal("");
      setModeloId("");
      setAtiva(true);
      setPreview("");
    }
  }, [editing, open]);

  function submit() {
    if (!obraId || !codigo.trim() || !nome.trim()) {
      toast.error("Obra, código e nome são obrigatórios.");
      return;
    }
    onSubmit({
      obra_id: obraId,
      tipo,
      codigo: codigo.trim(),
      nome: nome.trim(),
      local: local.trim() || null,
      modelo_id: modeloId || null,
      ativa,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar alvo" : "Novo alvo de QR"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Obra</Label>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABEL) as Tipo[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Código</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="EQ-001"
            />
          </div>
          <div className="col-span-2">
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Grua A — Bloco 1"
            />
          </div>
          <div className="col-span-2">
            <Label>Local sugerido (opcional)</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Modelo padrão (opcional)</Label>
            <Select value={modeloId} onValueChange={setModeloId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem padrão (escolha ao escanear)" />
              </SelectTrigger>
              <SelectContent>
                {modelos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.codigo} — {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex items-center justify-between border rounded-md px-3 py-2">
            <span className="text-sm">Alvo ativo</span>
            <Switch checked={ativa} onCheckedChange={setAtiva} />
          </div>
          {preview && (
            <div className="col-span-2 flex items-center gap-3 border rounded p-3">
              <img src={preview} alt="QR" className="w-28 h-28" />
              <div className="text-xs text-muted-foreground">
                Aponte a câmera para abrir a captura desta inspeção. Reuse este QR sempre — ele
                permanece válido enquanto o alvo existir.
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
