/**
 * Captura de inspeção (offline-first).
 *
 * Carrega o modelo + perguntas do banco, monta um `ModeloTemplate` em runtime
 * usando o `id` da pergunta como `tempId` (perguntaIdPorTempId fica identity),
 * e delega toda a persistência ao `useInspecaoOffline` — que usa o motor
 * offline genérico já testado (IndexedDB + sync_queue + media_queue + backoff).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { inspecaoModelosRepo, inspecaoPerguntasRepo } from "@/lib/repositories/inspecoes";
import { useObras } from "@/hooks/obras/useObras";
import { useAuth } from "@/contexts/auth/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Camera, AlertTriangle, CheckCircle2, PenLine, FileText } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "@/components/qualidade/SignaturePad";
import { useInspecaoOffline } from "@/lib/qualidade/useInspecaoOffline";
import { emptyInspecao } from "@/lib/qualidade/offline";
import type { ModeloTemplate, PerguntaTemplate, PerguntaTipo } from "@/lib/qualidade/modelos";
import { perguntasVisiveis } from "@/lib/qualidade/modelos";
import { exportInspecaoToPDF } from "@/lib/qualidade/export-pdf";
import { empresaParametrizacaoRepo, getInstitucionalHeaderLines } from "@/lib/empresa/parametrizacao";

interface DbPergunta {
  id: string;
  modelo_id: string;
  ordem: number;
  grupo: string | null;
  texto: string;
  tipo: PerguntaTipo;
  obrigatoria: boolean;
  peso: number;
  config: Record<string, unknown> | null;
  depende_de: string | null;
  depende_valor: string | null;
  gera_nc_se: string | null;
}

interface DbModelo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: ModeloTemplate["categoria"];
  setor: ModeloTemplate["setor"];
  score_minimo: number | null;
}

export default function InspecaoCaptura() {
  const { modeloId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentPlayer } = useAuth();
  const inspecaoIdParam = searchParams.get("inspecao") ?? undefined;
  const [obraSel, setObraSel] = useState<string>("");
  const [assinaturaOpen, setAssinaturaOpen] = useState(false);
  const [assinanteNome, setAssinanteNome] = useState("");
  const [uploadingAssinatura, setUploadingAssinatura] = useState(false);
  const sigRef = useRef<SignaturePadHandle | null>(null);

  // Modelo + perguntas
  const { data: modeloRow } = useQuery({
    queryKey: ["modelo", modeloId],
    queryFn: async () => {
      return (await inspecaoModelosRepo.getById(modeloId)) as DbModelo | null;
    },
    enabled: !!modeloId,
  });

  const { data: perguntas = [] } = useQuery({
    queryKey: ["modelo-perguntas", modeloId],
    queryFn: async () => {
      return (await inspecaoPerguntasRepo.listPorModelo(modeloId)) as DbPergunta[];
    },
    enabled: !!modeloId,
  });

  const obrasQuery = useObras();
  const obras = useMemo(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );

  // Constrói ModeloTemplate em runtime usando id como tempId.
  const modeloTpl: ModeloTemplate | null = useMemo(() => {
    if (!modeloRow) return null;
    const tpl: ModeloTemplate = {
      codigo: modeloRow.codigo,
      nome: modeloRow.nome,
      categoria: modeloRow.categoria,
      setor: (modeloRow.setor ?? "Qualidade") as ModeloTemplate["setor"],
      descricao: modeloRow.descricao ?? "",
      scoreMinimo: modeloRow.score_minimo ?? undefined,
      perguntas: perguntas.map<PerguntaTemplate>((p) => ({
        tempId: p.id,
        texto: p.texto,
        tipo: p.tipo,
        grupo: p.grupo ?? undefined,
        obrigatoria: p.obrigatoria,
        peso: Number(p.peso) || 1,
        config: p.config ?? {},
        dependeDe: p.depende_de ?? undefined,
        dependeValor: p.depende_valor ?? undefined,
        geraNcSe: p.gera_nc_se ?? undefined,
      })),
    };
    return tpl;
  }, [modeloRow, perguntas]);

  const perguntaIdPorTempId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of perguntas) m[p.id] = p.id;
    return m;
  }, [perguntas]);

  // Inicialização da inspeção
  const inicializadoRef = useRef(false);
  const [inicial] = useState(() =>
    emptyInspecao({
      modeloId,
      obraId: "", // preenchemos depois que o usuário escolher
      responsavelId: currentPlayer?.id,
    }),
  );

  const inspecao = useInspecaoOffline({
    key: `inspecao:${modeloId}:${inspecaoIdParam ?? inicial.inspecao_id}`,
    modelo: modeloTpl ?? {
      codigo: "x",
      nome: "",
      categoria: "outros",
      setor: "Qualidade",
      descricao: "",
      perguntas: [],
    },
    perguntaIdPorTempId,
    initial: inicial,
    createdBy: currentPlayer?.id ?? "",
  });

  // Atualiza obra_id quando usuário escolhe
  useEffect(() => {
    if (!obraSel || inspecao.data.obra_id === obraSel) return;
    inspecao.setData((prev) => ({ ...prev, obra_id: obraSel }));
  }, [obraSel, inspecao]);

  // Pré-seleciona obra se já houver no draft hidratado
  useEffect(() => {
    if (!inicializadoRef.current && inspecao.hydrated && inspecao.data.obra_id) {
      setObraSel(inspecao.data.obra_id);
      inicializadoRef.current = true;
    }
  }, [inspecao.hydrated, inspecao.data.obra_id]);

  // Prefill via QR (?obra=&local=)
  const qrAplicadoRef = useRef(false);
  useEffect(() => {
    if (qrAplicadoRef.current || !inspecao.hydrated) return;
    const qpObra = searchParams.get("obra");
    const qpLocal = searchParams.get("local");
    if (!qpObra && !qpLocal) return;
    qrAplicadoRef.current = true;
    if (qpObra && !inspecao.data.obra_id) setObraSel(qpObra);
    if (qpLocal && !inspecao.data.local) {
      inspecao.setData((p) => ({ ...p, local: qpLocal }));
    }
  }, [searchParams, inspecao]);

  if (!modeloTpl) {
    return <div className="text-sm text-muted-foreground">Carregando modelo…</div>;
  }

  const respostasParaCondicional: Record<string, string | number | undefined> = {};
  for (const r of Object.values(inspecao.data.respostas)) {
    respostasParaCondicional[r.perguntaTempId] =
      r.conformidade ?? r.resposta_opcao ?? r.resposta_texto ?? r.resposta_numero;
  }
  const visiveis = perguntasVisiveis(modeloTpl, respostasParaCondicional);
  const ncsCount = inspecao.data.ncs.length;

  // Agrupa visíveis por grupo
  const grupos = new Map<string, PerguntaTemplate[]>();
  for (const p of visiveis) {
    const k = p.grupo ?? "Geral";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(p);
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto px-3 sm:px-0 pb-32">
      <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-background/95 backdrop-blur border-b px-3 py-2 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/inspecoes")} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Badge
            variant={inspecao.score >= (modeloTpl.scoreMinimo ?? 0) ? "default" : "destructive"}
          >
            {inspecao.score.toFixed(0)}%
          </Badge>
          {ncsCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> {ncsCount} NC
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={Object.keys(inspecao.data.respostas).length === 0}
            onClick={async () => {
              const obraSel = obras.find((o) => o.id === inspecao.data.obra_id) as any;
              const obraNome = obraSel?.nome;
              const empresaId =
                typeof obraSel?.empresa_id === "string" ? obraSel.empresa_id : null;
              const logoDataUrl = empresaId
                ? (empresaParametrizacaoRepo.get(empresaId).logoUrl ?? undefined)
                : undefined;
              const institucionalLines = getInstitucionalHeaderLines(empresaId);
              const responsavelNome = currentPlayer?.login;
              const assinanteMatch = inspecao.data.observacao?.match(/Assinado por:\s*(.+)/i);
              await exportInspecaoToPDF({
                modelo: modeloTpl,
                inspecao: inspecao.data,
                score: inspecao.score,
                obraNome,
                responsavelNome,
                assinanteNome: assinanteMatch?.[1]?.trim(),
                logoDataUrl,
                institucionalLines,
                carregarImagem: async (path) => {
                  try {
                    const { data, error } = await supabase.storage
                      .from("inspecoes-fotos")
                      .download(path);
                    if (error || !data) return null;
                    return await new Promise<string>((resolve, reject) => {
                      const fr = new FileReader();
                      fr.onload = () => resolve(fr.result as string);
                      fr.onerror = () => reject(fr.error);
                      fr.readAsDataURL(data);
                    });
                  } catch {
                    return null;
                  }
                },
              });
            }}
          >
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>


      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{modeloTpl.nome}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {modeloTpl.codigo} · {modeloTpl.setor}
              </p>
            </div>
            <div className="text-right">
              <Badge
                variant={inspecao.score >= (modeloTpl.scoreMinimo ?? 0) ? "default" : "destructive"}
              >
                Score {inspecao.score.toFixed(0)}%
              </Badge>
              {ncsCount > 0 && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1 justify-end">
                  <AlertTriangle className="h-3 w-3" /> {ncsCount} NC{ncsCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Obra</Label>
              <Select value={obraSel} onValueChange={setObraSel}>
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
              <Label>Local / Eixo</Label>
              <Input
                value={inspecao.data.local ?? ""}
                onChange={(e) => inspecao.setData((p) => ({ ...p, local: e.target.value }))}
                placeholder="Ex.: Pav. 3 — Eixo B"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {[...grupos.entries()].map(([grupo, items]) => (
        <Card key={grupo}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {grupo}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((p) => (
              <PerguntaInput
                key={p.tempId}
                pergunta={p}
                resposta={Object.values(inspecao.data.respostas).find(
                  (r) => r.perguntaTempId === p.tempId,
                )}
                fotos={inspecao.data.fotos.filter((f) =>
                  Object.values(inspecao.data.respostas).some(
                    (r) => r.id === f.respostaId && r.perguntaTempId === p.tempId,
                  ),
                )}
                onResponder={(patch) => inspecao.responder(p.tempId, patch)}
                onFoto={(file) => inspecao.addFoto(p.tempId, file)}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div>
            <Label>Observação geral</Label>
            <Textarea
              value={inspecao.data.observacao ?? ""}
              onChange={(e) => inspecao.setData((p) => ({ ...p, observacao: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {inspecao.online ? "Online" : "Offline"} · {inspecao.status}
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t p-3 flex gap-2 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:p-0 sm:justify-end">
        <Button
          variant="outline"
          onClick={inspecao.commit}
          disabled={inspecao.syncing}
          className="flex-1 sm:flex-none h-11"
        >
          Salvar rascunho
        </Button>
        <Button
          onClick={() => {
            setAssinanteNome(currentPlayer?.login ?? "");
            setAssinaturaOpen(true);
          }}
          disabled={inspecao.syncing || !inspecao.data.obra_id}
          className="gap-1 flex-1 sm:flex-none h-11"
        >
          <CheckCircle2 className="h-4 w-4" />
          Concluir
        </Button>
      </div>

      <Dialog
        open={assinaturaOpen}
        onOpenChange={(o) => !uploadingAssinatura && setAssinaturaOpen(o)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-4 w-4" /> Assinatura do responsável
            </DialogTitle>
            <DialogDescription>
              A assinatura é armazenada com a inspeção como evidência da conclusão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do responsável</Label>
              <Input
                value={assinanteNome}
                onChange={(e) => setAssinanteNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <SignaturePad ref={sigRef} />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAssinaturaOpen(false)}
              disabled={uploadingAssinatura}
            >
              Cancelar
            </Button>
            <Button
              disabled={uploadingAssinatura}
              onClick={async () => {
                if (sigRef.current?.isEmpty()) {
                  toast.error("Assine antes de concluir.");
                  return;
                }
                if (!assinanteNome.trim()) {
                  toast.error("Informe o nome do responsável.");
                  return;
                }
                setUploadingAssinatura(true);
                try {
                  const blob = await sigRef.current!.toBlob();
                  if (!blob) throw new Error("Falha ao gerar assinatura");
                  const path = `assinaturas/${inspecao.data.inspecao_id}.png`;
                  const up = await supabase.storage
                    .from("inspecoes-fotos")
                    .upload(path, blob, { upsert: true, contentType: "image/png" });
                  if (up.error) throw up.error;
                  const nomeAssinante = assinanteNome.trim();
                  inspecao.setData((p) => ({
                    ...p,
                    assinatura_path: path,
                    observacao: p.observacao
                      ? `${p.observacao}\nAssinado por: ${nomeAssinante}`
                      : `Assinado por: ${nomeAssinante}`,
                  }));
                  await inspecao.concluir();
                  setAssinaturaOpen(false);
                  toast.success("Inspeção concluída e assinada.");
                  navigate("/inspecoes");
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Erro ao salvar assinatura";
                  toast.error(msg);
                } finally {
                  setUploadingAssinatura(false);
                }
              }}
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              {uploadingAssinatura ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PerguntaInputProps {
  pergunta: PerguntaTemplate;
  resposta?: {
    id: string;
    perguntaTempId: string;
    resposta_texto?: string;
    resposta_numero?: number;
    resposta_opcao?: string;
    conformidade?: "sim" | "nao" | "na";
    observacao?: string;
  };
  fotos: { id: string; path: string }[];
  onResponder: (
    patch: Partial<{
      resposta_texto: string;
      resposta_numero: number;
      resposta_opcao: string;
      conformidade: "sim" | "nao" | "na";
      observacao: string;
    }>,
  ) => void;
  onFoto: (file: File) => Promise<void>;
}

function PerguntaInput({ pergunta, resposta, fotos, onResponder, onFoto }: PerguntaInputProps) {
  const opcoes = (pergunta.config?.opcoes as string[] | undefined) ?? [];
  const unidade = pergunta.config?.unidade as string | undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Label className="leading-snug">
          {pergunta.texto}
          {pergunta.obrigatoria && <span className="text-destructive ml-1">*</span>}
        </Label>
        {pergunta.geraNcSe && resposta?.conformidade === pergunta.geraNcSe && (
          <Badge variant="destructive" className="text-xs shrink-0">
            NC
          </Badge>
        )}
      </div>

      {pergunta.tipo === "sim_nao_na" && (
        <RadioGroup
          value={resposta?.conformidade ?? ""}
          onValueChange={(v) => onResponder({ conformidade: v as "sim" | "nao" | "na" })}
          className="grid grid-cols-3 gap-2"
        >
          {(["sim", "nao", "na"] as const).map((v) => (
            <label
              key={v}
              className="flex items-center justify-center gap-2 h-11 rounded-md border bg-background text-sm font-medium cursor-pointer hover:bg-accent has-[input:checked]:bg-primary has-[input:checked]:text-primary-foreground has-[input:checked]:border-primary transition-colors"
            >
              <RadioGroupItem value={v} className="sr-only" />
              {v === "na" ? "N/A" : v.toUpperCase()}
            </label>
          ))}
        </RadioGroup>
      )}

      {pergunta.tipo === "texto" && (
        <Input
          value={resposta?.resposta_texto ?? ""}
          onChange={(e) => onResponder({ resposta_texto: e.target.value })}
        />
      )}

      {pergunta.tipo === "numero" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={resposta?.resposta_numero ?? ""}
            onChange={(e) =>
              onResponder({
                resposta_numero: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            className="max-w-[160px]"
          />
          {unidade && <span className="text-xs text-muted-foreground">{unidade}</span>}
        </div>
      )}

      {pergunta.tipo === "escolha" && (
        <Select
          value={resposta?.resposta_opcao ?? ""}
          onValueChange={(v) => onResponder({ resposta_opcao: v })}
        >
          <SelectTrigger className="max-w-[260px]">
            <SelectValue placeholder="Selecione…" />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {pergunta.tipo === "foto" && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            id={`foto-${pergunta.tempId}`}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFoto(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              // Garante uma resposta-placeholder para anexar a foto
              if (!resposta) onResponder({ observacao: "" });
              document.getElementById(`foto-${pergunta.tempId}`)?.click();
            }}
            className="gap-1"
          >
            <Camera className="h-4 w-4" /> Adicionar foto
          </Button>
          {fotos.length > 0 && (
            <p className="text-xs text-muted-foreground">{fotos.length} foto(s) anexada(s)</p>
          )}
        </div>
      )}

      <Input
        placeholder="Observação (opcional)"
        value={resposta?.observacao ?? ""}
        onChange={(e) => onResponder({ observacao: e.target.value })}
        className="text-xs h-8"
      />
    </div>
  );
}
