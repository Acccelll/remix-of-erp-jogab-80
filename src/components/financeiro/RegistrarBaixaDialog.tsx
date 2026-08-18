import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/billing";
import { baixarTituloCanonico, type TituloCanonicoResumo } from "@/lib/repositories/financeiro-titulos";

interface RegistrarBaixaDialogProps {
  titulo: TituloCanonicoResumo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
}

type CampoNumerico = "principal" | "desconto" | "juros" | "multa" | "acrescimos" | "retencoes";

type ValoresForm = Record<CampoNumerico, string>;

function hojeIso(): string {
  const data = new Date();
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function parseValor(value: string): number {
  const normalizado = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalizado);
  return Number.isFinite(parsed) ? parsed : 0;
}

function valorInicial(saldo: number): ValoresForm {
  return {
    principal: saldo > 0 ? saldo.toFixed(2).replace(".", ",") : "",
    desconto: "",
    juros: "",
    multa: "",
    acrescimos: "",
    retencoes: "",
  };
}

export function RegistrarBaixaDialog({
  titulo,
  open,
  onOpenChange,
  onSuccess,
}: RegistrarBaixaDialogProps) {
  const [valores, setValores] = useState<ValoresForm>(() => valorInicial(titulo.saldo_aberto));
  const [dataBaixa, setDataBaixa] = useState(hojeIso);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [referencia, setReferencia] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) return;
    setValores(valorInicial(titulo.saldo_aberto));
    setDataBaixa(hojeIso());
    setFormaPagamento("");
    setReferencia("");
    setObservacao("");
  }, [open, titulo.id, titulo.saldo_aberto]);

  const numericos = useMemo(
    () => ({
      principal: parseValor(valores.principal),
      desconto: parseValor(valores.desconto),
      juros: parseValor(valores.juros),
      multa: parseValor(valores.multa),
      acrescimos: parseValor(valores.acrescimos),
      retencoes: parseValor(valores.retencoes),
    }),
    [valores],
  );

  const erroValidacao = useMemo(() => {
    if (!dataBaixa) return "Informe a data da baixa.";
    if (numericos.principal <= 0) return "O valor principal deve ser maior que zero.";
    if (numericos.principal > titulo.saldo_aberto + 0.005) {
      return "O valor principal não pode exceder o saldo em aberto.";
    }
    if (
      [
        numericos.desconto,
        numericos.juros,
        numericos.multa,
        numericos.acrescimos,
        numericos.retencoes,
      ].some((valor) => valor < 0)
    ) {
      return "Ajustes da baixa não podem ser negativos.";
    }
    return null;
  }, [dataBaixa, numericos, titulo.saldo_aberto]);

  const mutation = useMutation({
    mutationFn: () =>
      baixarTituloCanonico({
        titulo_id: titulo.id,
        valor_principal: numericos.principal,
        data_baixa: dataBaixa,
        valor_desconto: numericos.desconto,
        valor_juros: numericos.juros,
        valor_multa: numericos.multa,
        valor_acrescimos: numericos.acrescimos,
        valor_retencoes: numericos.retencoes,
        forma_pagamento: formaPagamento.trim() || null,
        referencia: referencia.trim() || null,
        observacao: observacao.trim() || null,
        origem_tipo: "manual",
      }),
    onSuccess: async () => {
      toast.success("Baixa registrada no título.");
      await onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível registrar a baixa."),
  });

  function alterarValor(campo: CampoNumerico, value: string) {
    setValores((atual) => ({ ...atual, [campo]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar baixa</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Saldo em aberto: </span>
          <strong className="tabular-nums">{brl(titulo.saldo_aberto)}</strong>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="baixa-principal">Valor principal</Label>
            <Input
              id="baixa-principal"
              inputMode="decimal"
              value={valores.principal}
              onChange={(event) => alterarValor("principal", event.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="baixa-data">Data da baixa</Label>
            <Input
              id="baixa-data"
              type="date"
              value={dataBaixa}
              onChange={(event) => setDataBaixa(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ["desconto", "Desconto"],
              ["juros", "Juros"],
              ["multa", "Multa"],
              ["acrescimos", "Acréscimos"],
              ["retencoes", "Retenções"],
            ] as const
          ).map(([campo, label]) => (
            <div key={campo} className="space-y-1.5">
              <Label htmlFor={`baixa-${campo}`}>{label}</Label>
              <Input
                id={`baixa-${campo}`}
                inputMode="decimal"
                placeholder="0,00"
                value={valores[campo]}
                onChange={(event) => alterarValor(campo, event.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="baixa-forma">Forma de pagamento</Label>
            <Input
              id="baixa-forma"
              value={formaPagamento}
              onChange={(event) => setFormaPagamento(event.target.value)}
              placeholder="Ex.: Pix, TED, boleto"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="baixa-referencia">Referência</Label>
            <Input
              id="baixa-referencia"
              value={referencia}
              onChange={(event) => setReferencia(event.target.value)}
              placeholder="Comprovante, protocolo…"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="baixa-observacao">Observação</Label>
          <Textarea
            id="baixa-observacao"
            value={observacao}
            onChange={(event) => setObservacao(event.target.value)}
            rows={3}
          />
        </div>

        {erroValidacao && <p className="text-sm text-destructive">{erroValidacao}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!!erroValidacao || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando…
              </>
            ) : (
              "Confirmar baixa"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RegistrarBaixaDialog;
