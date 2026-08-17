import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { toast } from "sonner";
import { obrasRepo } from "@/lib/repositories/obras";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipsNumberInput } from "@/components/ui/chips-number-input";
import { brl } from "@/lib/billing";

export function resumoRegua(obra: any): string {
  const cortes: number[] = obra?.dias_corte_bms ?? [];
  const pagos: number[] = obra?.dias_fixos_pagamento ?? [];
  const nf = obra?.dias_ate_emissao_nf ?? obra?.prazo_emitir_nf_dias ?? 5;
  const ddl = obra?.prazo_pagamento_dias;
  const antec = Number(obra?.valor_antecipacao ?? 0);
  const partes: string[] = [];
  partes.push(cortes.length ? `Corte ${cortes.join(" e ")}` : "Corte —");
  partes.push(`NFS +${nf}d`);
  partes.push(ddl != null ? `${ddl} DDL` : "DDL —");
  partes.push(pagos.length ? `paga dia ${pagos.join(" ou ")}` : "sem dia fixo");
  if (antec > 0) partes.push(`Antecip. ${brl(antec)}`);
  return partes.join(" · ");
}

export function ReguaEditor({
  obra,
  aReceber,
  onSaved,
}: {
  obra: any;
  aReceber?: number;
  onSaved: () => void;
}) {
  const [cortes, setCortes] = useState<number[]>(obra.dias_corte_bms ?? []);
  const [nfDias, setNfDias] = useState<string>(String(obra.dias_ate_emissao_nf ?? 5));
  const [ddl, setDdl] = useState<string>(
    obra.prazo_pagamento_dias != null ? String(obra.prazo_pagamento_dias) : "",
  );
  const [pagos, setPagos] = useState<number[]>(obra.dias_fixos_pagamento ?? []);
  const valorContrato = Number(obra.valor_contrato || 0);
  const [antecValorStr, setAntecValorStr] = useState<string>(
    obra.valor_antecipacao != null && Number(obra.valor_antecipacao) > 0
      ? String(obra.valor_antecipacao)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const temRegua = Array.isArray(obra.dias_corte_bms) && obra.dias_corte_bms.length > 0;
  const [open, setOpen] = useState(!temRegua);

  const antecValor = Number(antecValorStr || 0);
  const antecPctNum =
    valorContrato > 0 && antecValor > 0
      ? Number(((antecValor / valorContrato) * 100).toFixed(4))
      : 0;

  const dirty =
    JSON.stringify(cortes) !== JSON.stringify(obra.dias_corte_bms ?? []) ||
    Number(nfDias || 0) !== Number(obra.dias_ate_emissao_nf ?? 5) ||
    (ddl === ""
      ? obra.prazo_pagamento_dias != null
      : Number(ddl) !== Number(obra.prazo_pagamento_dias)) ||
    JSON.stringify(pagos) !== JSON.stringify(obra.dias_fixos_pagamento ?? []) ||
    antecValor !== Number(obra.valor_antecipacao ?? 0);

  async function salvar() {
    setSaving(true);
    const payload: any = {
      dias_corte_bms: cortes,
      dias_fixos_pagamento: pagos,
      dias_ate_emissao_nf: Number(nfDias || 5),
      prazo_emitir_nf_dias: Number(nfDias || 5),
      prazo_pagamento_dias: ddl === "" ? null : Number(ddl),
      dia_fixo_pagamento: pagos.length ? pagos[0] : null,
      valor_antecipacao: antecValor > 0 ? antecValor : null,
      percentual_antecipacao: antecPctNum > 0 ? antecPctNum : null,
    };
    try {
      await obrasRepo.update(obra.id, payload);
    } catch (e) {
      setSaving(false);
      return toast.error((e as Error).message);
    }
    setSaving(false);
    toast.success("Régua atualizada");
    onSaved();
  }

  const resumo = resumoRegua({
    ...obra,
    dias_corte_bms: cortes,
    dias_fixos_pagamento: pagos,
    dias_ate_emissao_nf: Number(nfDias || 5),
    prazo_pagamento_dias: ddl === "" ? null : Number(ddl),
    valor_antecipacao: antecValor > 0 ? antecValor : null,
  });

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CardTitle className="text-base shrink-0">Régua de medição e pagamento</CardTitle>
                {!open && (
                  <span className="text-sm text-muted-foreground truncate">· {resumo}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!open && aReceber != null && (
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    A receber:{" "}
                    <span className="font-medium text-foreground num">{brl(aReceber)}</span>
                  </span>
                )}
                {!open && (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                )}
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Dias de corte da BMS</Label>
              <ChipsNumberInput value={cortes} onChange={setCortes} placeholder="Ex.: 15, 30" />
              <p className="text-xs text-muted-foreground">1 a 31. Adicione vários.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Dias até emissão da NFS</Label>
              <Input
                type="number"
                min={0}
                value={nfDias}
                onChange={(e) => setNfDias(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Padrão 5 dias após o corte.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Prazo de pagamento (DDL)</Label>
              <Input
                type="number"
                min={0}
                value={ddl}
                onChange={(e) => setDdl(e.target.value)}
                placeholder="ex.: 28"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dias fixos de pagamento</Label>
              <ChipsNumberInput value={pagos} onChange={setPagos} placeholder="Ex.: 1, 15" />
              <p className="text-xs text-muted-foreground">Vazio = paga DDL direto.</p>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Antecipação / Mobilização (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={antecValorStr}
                onChange={(e) => setAntecValorStr(e.target.value)}
                placeholder="0,00"
              />
              {antecValor > 0 && valorContrato > 0 && (
                <p className="text-xs text-muted-foreground">
                  = {antecPctNum.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do contrato
                </p>
              )}
            </div>
            <div className="md:col-span-4 flex items-center justify-between border-t pt-3">
              <div className="text-sm text-muted-foreground">{resumo}</div>
              <Button size="sm" onClick={salvar} disabled={!dirty || saving}>
                {saving ? "Salvando…" : "Salvar régua"}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
