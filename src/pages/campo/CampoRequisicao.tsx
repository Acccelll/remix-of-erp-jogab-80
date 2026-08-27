/**
 * Portal de Campo — Requisição de Material. UI de campo sobre o fluxo
 * `solicitacoes_almoxarifado` já existente (origem='campo'), não um
 * conceito novo (decisão registrada no system design §5.3/§5.9) — a mesma
 * solicitação criada aqui aparece na fila de triagem do Almoxarifado
 * (`Almoxarifado.tsx`) do outro lado.
 *
 * `cronograma_item_id` é obrigatório no schema (toda solicitação nasce de
 * uma atividade) — por isso o formulário pede a atividade antes dos itens.
 */
import { useMemo, useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cronogramaRepo } from "@/lib/repositories/cronograma";
import { solicitacoesAlmoxarifadoRepo } from "@/lib/repositories/almoxarifado";

interface ItemForm {
  id: string;
  descricao: string;
  quantidade: string;
  unidade: string;
}

function novoItem(): ItemForm {
  return { id: crypto.randomUUID(), descricao: "", quantidade: "1", unidade: "" };
}

export default function CampoRequisicao() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const obraId = params.get("obra");

  const [cronogramaItemId, setCronogramaItemId] = useState("");
  const [urgencia, setUrgencia] = useState<"normal" | "urgente">("normal");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([novoItem()]);

  const atividadesQ = useQuery({
    queryKey: ["campo-cronograma", obraId],
    queryFn: () => cronogramaRepo.listByObra(obraId as string),
    enabled: !!obraId,
  });
  const atividades = useMemo(
    () => (atividadesQ.data ?? []).filter((i: any) => i.ativo),
    [atividadesQ.data],
  );

  const criar = useMutation({
    mutationFn: () =>
      solicitacoesAlmoxarifadoRepo.criarSolicitacaoCampo({
        obraId: obraId as string,
        cronogramaItemId,
        urgencia,
        observacao,
        itens: itens
          .filter((i) => i.descricao.trim())
          .map((i) => ({
            descricaoLivre: i.descricao.trim(),
            quantidade: Number(i.quantidade) || 1,
            unidade: i.unidade.trim() || null,
          })),
      }),
    onSuccess: () => {
      toast.success("Solicitação enviada para o almoxarifado.");
      qc.invalidateQueries({ queryKey: ["campo-cronograma", obraId] });
      navigate("/campo");
    },
    onError: (e) => toast.error((e as Error)?.message ?? "Falha ao enviar solicitação."),
  });

  if (!obraId) return <Navigate to="/campo" replace />;

  const itensValidos = itens.some((i) => i.descricao.trim());
  const podeEnviar = !!cronogramaItemId && itensValidos && !criar.isPending;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/campo")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      <h1 className="text-lg font-semibold">Requisitar material</h1>

      <div className="space-y-2">
        <Label>Atividade</Label>
        <Select value={cronogramaItemId} onValueChange={setCronogramaItemId}>
          <SelectTrigger>
            <SelectValue placeholder="Para qual atividade é este material?" />
          </SelectTrigger>
          <SelectContent>
            {atividades.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>
                {a.descricao || "(sem descrição)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Urgência</Label>
        <Select value={urgencia} onValueChange={(v) => setUrgencia(v as "normal" | "urgente")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label>Itens</Label>
        {itens.map((item, idx) => (
          <div key={item.id} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="O que precisa? (ex.: cabo elétrico 2,5mm)"
                value={item.descricao}
                onChange={(e) =>
                  setItens((p) => p.map((x, j) => (j === idx ? { ...x, descricao: e.target.value } : x)))
                }
              />
            </div>
            <Input
              className="w-20"
              type="number"
              min={1}
              placeholder="Qtd"
              value={item.quantidade}
              onChange={(e) =>
                setItens((p) => p.map((x, j) => (j === idx ? { ...x, quantidade: e.target.value } : x)))
              }
            />
            <Input
              className="w-20"
              placeholder="Un."
              value={item.unidade}
              onChange={(e) =>
                setItens((p) => p.map((x, j) => (j === idx ? { ...x, unidade: e.target.value } : x)))
              }
            />
            <Button
              size="icon"
              variant="ghost"
              disabled={itens.length === 1}
              onClick={() => setItens((p) => p.filter((_, j) => j !== idx))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setItens((p) => [...p, novoItem()])}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar item
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Observação (opcional)</Label>
        <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
      </div>

      <Button className="w-full" disabled={!podeEnviar} onClick={() => criar.mutate()}>
        {criar.isPending ? "Enviando…" : "Enviar solicitação"}
      </Button>
    </div>
  );
}
