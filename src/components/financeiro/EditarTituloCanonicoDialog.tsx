import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FinanceiroSearchCombobox } from "@/components/financeiro/FinanceiroSearchCombobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/billing";
import { financeiroRepo, planoContasRepo } from "@/lib/repositories/financeiro";
import { listarTiposDocumentoFinanceiro } from "@/lib/repositories/financeiro-tipos-documento";
import { editarTituloManualCanonicoV3 } from "@/lib/repositories/financeiro-titulos-manual";
import type {
  RateioTituloRow,
  TituloCanonicoResumo,
} from "@/lib/repositories/financeiro-titulos";

type RateioLinha = {
  id: string;
  cod_natureza: string;
  centro_custo: string;
  valor_rateio: string;
};

interface EditarTituloCanonicoDialogProps {
  titulo: TituloCanonicoResumo;
  rateios: RateioTituloRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
}

function novaLinha(): RateioLinha {
  return { id: crypto.randomUUID(), cod_natureza: "", centro_custo: "", valor_rateio: "" };
}

export function EditarTituloCanonicoDialog({
  titulo,
  rateios: rateiosAtuais,
  open,
  onOpenChange,
  onSuccess,
}: EditarTituloCanonicoDialogProps) {
  const [naturezaTipo, setNaturezaTipo] = useState<"1" | "2">(titulo.tipo === "receber" ? "1" : "2");
  const [tipoDocumento, setTipoDocumento] = useState(titulo.tipo_documento ?? "");
  const [documento, setDocumento] = useState(titulo.numero_documento ?? "");
  const [nome, setNome] = useState(titulo.nome ?? "");
  const [cnpjCpf, setCnpjCpf] = useState(titulo.cnpj_cpf ?? "");
  const [dataEmissao, setDataEmissao] = useState(titulo.data_emissao ?? "");
  const [dataVencimento, setDataVencimento] = useState(titulo.data_vencimento ?? "");
  const [historico, setHistorico] = useState(titulo.historico ?? "");
  const [rateios, setRateios] = useState<RateioLinha[]>([novaLinha()]);

  useEffect(() => {
    if (!open) return;
    setNaturezaTipo(titulo.tipo === "receber" ? "1" : "2");
    setTipoDocumento(titulo.tipo_documento ?? "");
    setDocumento(titulo.numero_documento ?? "");
    setNome(titulo.nome ?? "");
    setCnpjCpf(titulo.cnpj_cpf ?? "");
    setDataEmissao(titulo.data_emissao ?? "");
    setDataVencimento(titulo.data_vencimento ?? "");
    setHistorico(titulo.historico ?? "");
    setRateios(
      rateiosAtuais.length
        ? rateiosAtuais.map((rateio) => ({
            id: crypto.randomUUID(),
            cod_natureza: rateio.cod_natureza,
            centro_custo: rateio.centro_custo,
            valor_rateio: String(rateio.valor ?? 0),
          }))
        : [novaLinha()],
    );
  }, [open, titulo, rateiosAtuais]);

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
  const { data: tiposDocumento } = useQuery({
    queryKey: ["fin_tipos_documento_select"],
    queryFn: listarTiposDocumentoFinanceiro,
    enabled: open,
  });

  const naturezasAtivas = useMemo(
    () => (naturezas ?? []).filter((natureza: any) => natureza.ativo !== false),
    [naturezas],
  );
  const naturezaOptions = useMemo(
    () =>
      naturezasAtivas.map((natureza: any) => ({
        value: String(natureza.cod_natureza),
        label: `${natureza.cod_natureza} — ${natureza.descricao ?? "Sem descrição"}`,
      })),
    [naturezasAtivas],
  );
  const centroOptions = useMemo(
    () =>
      (centros ?? []).map((centro) => ({
        value: centro.codigo,
        label: `${centro.codigo} — ${centro.nome ?? centro.codigo}`,
      })),
    [centros],
  );
  const tipoDocumentoOptions = useMemo(() => {
    const options = (tiposDocumento ?? []).map((tipo) => ({
      value: tipo.codigo,
      label: `${tipo.codigo} — ${tipo.descricao}`,
    }));

    if (tipoDocumento && !options.some((option) => option.value === tipoDocumento)) {
      options.unshift({
        value: tipoDocumento,
        label: `${tipoDocumento} — Código atual não disponível no catálogo ativo`,
      });
    }

    return options;
  }, [tiposDocumento, tipoDocumento]);

  const total = useMemo(
    () => rateios.reduce((acc, item) => acc + (Number(item.valor_rateio.replace(",", ".")) || 0), 0),
    [rateios],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      await editarTituloManualCanonicoV3({
        titulo_id: titulo.id,
        natureza_tipo: Number(naturezaTipo) as 1 | 2,
        tipo_documento: tipoDocumento.trim(),
        numero_documento: documento.trim(),
        cnpj_cpf: cnpjCpf.trim() || null,
        nome: nome.trim() || null,
        data_emissao: dataEmissao || null,
        data_vencimento: dataVencimento,
        historico: historico.trim() || null,
        rateios: rateios.map((item) => ({
          cod_natureza: item.cod_natureza,
          centro_custo: item.centro_custo,
          valor_rateio: Number(item.valor_rateio.replace(",", ".")) || 0,
        })),
      });
    },
    onSuccess: async () => {
      toast.success("Título atualizado.");
      await onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const podeSalvar =
    Boolean(tipoDocumento.trim()) &&
    Boolean(documento.trim()) &&
    Boolean(dataVencimento) &&
    total > 0 &&
    rateios.every(
      (item) =>
        Boolean(item.cod_natureza) &&
        Boolean(item.centro_custo) &&
        Number(item.valor_rateio.replace(",", ".")) > 0,
    );

  function atualizarLinha(id: string, patch: Partial<RateioLinha>) {
    setRateios((atual) => atual.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar título ERP</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-w-xs space-y-1.5">
            <Label>Tipo</Label>
            <Select value={naturezaTipo} onValueChange={(value) => setNaturezaTipo(value as "1" | "2")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">A receber</SelectItem>
                <SelectItem value="2">A pagar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de Documento</Label>
              <FinanceiroSearchCombobox
                value={tipoDocumento}
                onValueChange={setTipoDocumento}
                options={tipoDocumentoOptions}
                placeholder="Selecione o tipo de documento"
                searchPlaceholder="Pesquisar por código ou descrição…"
                emptyText="Nenhum tipo de documento encontrado."
                ariaLabel="Tipo de Documento"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Documento</Label>
              <Input
                value={documento}
                onChange={(event) => setDocumento(event.target.value)}
                placeholder="Número do documento"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Contraparte</Label>
              <Input value={nome} onChange={(event) => setNome(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ/CPF</Label>
              <Input value={cnpjCpf} onChange={(event) => setCnpjCpf(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Data de emissão</Label>
              <Input type="date" value={dataEmissao} onChange={(event) => setDataEmissao(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de vencimento</Label>
              <Input type="date" value={dataVencimento} onChange={(event) => setDataVencimento(event.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Histórico</Label>
            <Textarea value={historico} onChange={(event) => setHistorico(event.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label>Rateio</Label>
                <p className="text-xs text-muted-foreground">
                  Pesquise Natureza e Centro de Custo por código ou descrição; a obra continua derivada pelo centro de custo.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setRateios((atual) => [...atual, novaLinha()])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Linha
              </Button>
            </div>

            <div className="space-y-2">
              {rateios.map((item) => (
                <div key={item.id} className="grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem_2.5rem]">
                  <FinanceiroSearchCombobox
                    value={item.cod_natureza}
                    onValueChange={(value) => atualizarLinha(item.id, { cod_natureza: value })}
                    options={naturezaOptions}
                    placeholder="Natureza"
                    searchPlaceholder="Pesquisar natureza…"
                    emptyText="Nenhuma natureza encontrada."
                    ariaLabel="Natureza do rateio"
                  />

                  <FinanceiroSearchCombobox
                    value={item.centro_custo}
                    onValueChange={(value) => atualizarLinha(item.id, { centro_custo: value })}
                    options={centroOptions}
                    placeholder="Centro de custo"
                    searchPlaceholder="Pesquisar centro de custo…"
                    emptyText="Nenhum centro de custo encontrado."
                    ariaLabel="Centro de custo do rateio"
                  />

                  <Input
                    inputMode="decimal"
                    value={item.valor_rateio}
                    onChange={(event) => atualizarLinha(item.id, { valor_rateio: event.target.value })}
                    placeholder="Valor"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={rateios.length === 1}
                    onClick={() => setRateios((atual) => atual.filter((linha) => linha.id !== item.id))}
                    aria-label="Remover linha de rateio"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-right text-sm font-medium">Total: {brl(total)}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!podeSalvar || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditarTituloCanonicoDialog;