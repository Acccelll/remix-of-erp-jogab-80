import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { financeiroRepo, planoContasRepo } from "@/lib/repositories/financeiro";
import { criarTituloManualCanonico } from "@/lib/repositories/financeiro-titulos";
import { brl } from "@/lib/billing";
import { finKeys } from "@/lib/financeiro-totvs/queries";
import type { RateioManualInput, TituloManualInput } from "@/lib/financeiro-totvs/types";

type RateioLinha = {
  id: string;
  cod_natureza: string;
  centro_custo: string;
  valor_rateio: string;
};

export type TituloManualEdicao = TituloManualInput & { ref_lancamento: number };

interface TituloManualFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente quando o dialog está editando um título já existente. */
  edicao?: TituloManualEdicao | null;
}

function novaLinhaVazia(): RateioLinha {
  return {
    id: crypto.randomUUID(),
    cod_natureza: "",
    centro_custo: "",
    valor_rateio: "",
  };
}

export function TituloManualFormDialog({
  open,
  onOpenChange,
  edicao,
}: TituloManualFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdicao = !!edicao;

  const [naturezaTipo, setNaturezaTipo] = useState<"1" | "2">("2");
  const [nome, setNome] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [historico, setHistorico] = useState("");
  const [rateios, setRateios] = useState<RateioLinha[]>([novaLinhaVazia()]);

  useEffect(() => {
    if (!open) return;
    if (edicao) {
      setNaturezaTipo(String(edicao.natureza_tipo) as "1" | "2");
      setNome(edicao.nome ?? "");
      setCnpjCpf(edicao.cnpj_cpf ?? "");
      setDataEmissao(edicao.data_emissao ?? "");
      setDataVencimento(edicao.data_vencimento);
      setHistorico(edicao.historico ?? "");
      setRateios(
        edicao.rateios.length
          ? edicao.rateios.map((r) => ({
              id: crypto.randomUUID(),
              cod_natureza: r.cod_natureza,
              centro_custo: r.centro_custo || edicao.centro_custo || "",
              valor_rateio: String(r.valor_rateio),
            }))
          : [novaLinhaVazia()],
      );
    } else {
      setNaturezaTipo("2");
      setNome("");
      setCnpjCpf("");
      setDataEmissao("");
      setDataVencimento("");
      setHistorico("");
      setRateios([novaLinhaVazia()]);
    }
  }, [open, edicao]);

  const { data: centros } = useQuery({
    queryKey: ["fin_centros_custo_select"],
    queryFn: () => financeiroRepo.listCentrosCustoTotvs(),
    enabled: open,
  });
  const { data: naturezas } = useQuery({
    queryKey: ["plano_contas_select"],
    queryFn: () => planoContasRepo.list(),
    enabled: open,
  });
  const naturezasAtivas = useMemo(
    () => (naturezas ?? []).filter((n: any) => n.ativo !== false),
    [naturezas],
  );

  const totalRateio = useMemo(
    () => rateios.reduce((acc, r) => acc + (Number(r.valor_rateio.replace(",", ".")) || 0), 0),
    [rateios],
  );

  function addLinha() {
    setRateios((prev) => [...prev, novaLinhaVazia()]);
  }
  function removeLinha(id: string) {
    setRateios((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }
  function updateLinha(id: string, patch: Partial<RateioLinha>) {
    setRateios((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const rateiosPayload: RateioManualInput[] = rateios.map((r) => ({
        cod_natureza: r.cod_natureza,
        centro_custo: r.centro_custo,
        valor_rateio: Number(r.valor_rateio.replace(",", ".")) || 0,
      }));
      const input: TituloManualInput = {
        natureza_tipo: Number(naturezaTipo) as 1 | 2,
        cnpj_cpf: cnpjCpf.trim() || null,
        nome: nome.trim() || null,
        data_emissao: dataEmissao || null,
        data_vencimento: dataVencimento,
        historico: historico.trim() || null,
        rateios: rateiosPayload,
      };

      if (isEdicao) {
        const centrosUnicos = new Set(rateiosPayload.map((r) => r.centro_custo));
        if (centrosUnicos.size !== 1) {
          throw new Error(
            "Edição de título com múltiplos centros de custo será habilitada na Etapa 6 — Operações.",
          );
        }
        await financeiroRepo.rpcEditarTituloManual(edicao!.ref_lancamento, {
          ...input,
          centro_custo: rateiosPayload[0].centro_custo ?? "",
        });
      } else {
        await criarTituloManualCanonico(input);
      }
    },
    onSuccess: () => {
      toast.success(isEdicao ? "Título atualizado." : "Título lançado.");
      queryClient.invalidateQueries({ queryKey: finKeys.geral });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? String(err));
    },
  });

  const podeSalvar =
    !!dataVencimento &&
    rateios.every(
      (r) =>
        r.cod_natureza &&
        r.centro_custo &&
        Number(r.valor_rateio.replace(",", ".")) > 0,
    ) &&
    totalRateio > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdicao ? "Editar título" : "Novo título"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-w-xs space-y-1.5">
            <Label>Tipo</Label>
            <Select value={naturezaTipo} onValueChange={(v) => setNaturezaTipo(v as "1" | "2")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">A receber</SelectItem>
                <SelectItem value="2">A pagar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contraparte (cliente/fornecedor)</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ/CPF</Label>
              <Input value={cnpjCpf} onChange={(e) => setCnpjCpf(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de emissão</Label>
              <Input
                type="date"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de vencimento</Label>
              <Input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Histórico</Label>
            <Textarea
              value={historico}
              onChange={(e) => setHistorico(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Rateio</Label>
                <p className="text-xs text-muted-foreground">
                  Cada linha classifica o valor por natureza e centro de custo; a obra é vinculada automaticamente pelo centro de custo.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLinha}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Linha
              </Button>
            </div>

            <div className="hidden md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem_2.5rem] gap-2 px-1 text-xs text-muted-foreground">
              <span>Natureza</span>
              <span>Centro de custo</span>
              <span>Valor</span>
              <span />
            </div>

            <div className="space-y-2">
              {rateios.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem_2.5rem] items-center gap-2"
                >
                  <Select
                    value={r.cod_natureza}
                    onValueChange={(v) => updateLinha(r.id, { cod_natureza: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Natureza" />
                    </SelectTrigger>
                    <SelectContent>
                      {naturezasAtivas.map((n: any) => (
                        <SelectItem key={n.cod_natureza} value={n.cod_natureza}>
                          {n.cod_natureza} — {n.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={r.centro_custo}
                    onValueChange={(v) => updateLinha(r.id, { centro_custo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Centro de custo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(centros ?? []).map((c) => (
                        <SelectItem key={c.codigo} value={c.codigo}>
                          {c.codigo} — {c.nome ?? c.codigo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    inputMode="decimal"
                    placeholder="Valor"
                    value={r.valor_rateio}
                    onChange={(e) => updateLinha(r.id, { valor_rateio: e.target.value })}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLinha(r.id)}
                    disabled={rateios.length === 1}
                    aria-label="Remover linha de rateio"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-right text-sm font-medium">Total: {brl(totalRateio)}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!podeSalvar || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…
              </>
            ) : isEdicao ? (
              "Salvar alterações"
            ) : (
              "Lançar título"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TituloManualFormDialog;
