import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { FinanceiroSearchCombobox } from "@/components/financeiro/FinanceiroSearchCombobox";
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
import { criarTituloManualCanonicoV3 } from "@/lib/repositories/financeiro-titulos-manual";
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
  /** Presente quando o dialog está editando um título legado já existente. */
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
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [documento, setDocumento] = useState("");
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
      setTipoDocumento("");
      setDocumento("");
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
      setTipoDocumento("");
      setDocumento("");
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
  const naturezaOptions = useMemo(
    () =>
      naturezasAtivas.map((n: any) => ({
        value: String(n.cod_natureza),
        label: `${n.cod_natureza} — ${n.descricao ?? "Sem descrição"}`,
      })),
    [naturezasAtivas],
  );
  const centroOptions = useMemo(
    () =>
      (centros ?? []).map((c) => ({
        value: c.codigo,
        label: `${c.codigo} — ${c.nome ?? c.codigo}`,
      })),
    [centros],
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
            "Edição legada de título com múltiplos centros de custo não é suportada por este fluxo.",
          );
        }
        await financeiroRepo.rpcEditarTituloManual(edicao!.ref_lancamento, {
          ...input,
          centro_custo: rateiosPayload[0].centro_custo ?? "",
        });
      } else {
        await criarTituloManualCanonicoV3({
          ...input,
          tipo_documento: tipoDocumento.trim(),
          numero_documento: documento.trim(),
        });
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

  const identificacaoOk = isEdicao || (tipoDocumento.trim().length > 0 && documento.trim().length > 0);
  const podeSalvar =
    identificacaoOk &&
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
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
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

          {!isEdicao && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de Documento</Label>
                <Input
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value)}
                  placeholder="Ex.: 04, 39, NF, BOL"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Documento</Label>
                <Input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="Número do documento"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Contraparte (cliente/fornecedor)</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ/CPF</Label>
              <Input value={cnpjCpf} onChange={(e) => setCnpjCpf(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  Pesquise por código ou descrição da Natureza e do Centro de Custo. A obra é vinculada automaticamente pelo centro de custo.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLinha}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Linha
              </Button>
            </div>

            <div className="hidden gap-2 px-1 text-xs text-muted-foreground md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem_2.5rem]">
              <span>Natureza</span>
              <span>Centro de custo</span>
              <span>Valor</span>
              <span />
            </div>

            <div className="space-y-2">
              {rateios.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem_2.5rem]"
                >
                  <FinanceiroSearchCombobox
                    value={r.cod_natureza}
                    onValueChange={(value) => updateLinha(r.id, { cod_natureza: value })}
                    options={naturezaOptions}
                    placeholder="Natureza"
                    searchPlaceholder="Pesquisar natureza…"
                    emptyText="Nenhuma natureza encontrada."
                    ariaLabel="Natureza do rateio"
                  />

                  <FinanceiroSearchCombobox
                    value={r.centro_custo}
                    onValueChange={(value) => updateLinha(r.id, { centro_custo: value })}
                    options={centroOptions}
                    placeholder="Centro de custo"
                    searchPlaceholder="Pesquisar centro de custo…"
                    emptyText="Nenhum centro de custo encontrado."
                    ariaLabel="Centro de custo do rateio"
                  />

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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
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
