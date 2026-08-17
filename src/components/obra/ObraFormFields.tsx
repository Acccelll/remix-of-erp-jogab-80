import React from "react";
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
import { ChipsNumberInput } from "@/components/ui/chips-number-input";
import { MoneyInput } from "@/components/ui/money-input";
import { PercentInput } from "@/components/ui/percent-input";
import { brl } from "@/lib/billing";
import SeletorMunicipio from "@/components/rh/logistica/SeletorMunicipio";
import type { ObraFormErrors } from "@/lib/schemas/obra";

function F({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Form rico de obra — campos compartilhados entre criação (FinObras)
 * e edição (FinObras + FinObraDetalhe via EditObraDialog).
 */
export function ObraFormFields({
  state,
  setState,
  errors,
  isEdit,
  clientes,
}: {
  state: any;
  setState: (s: any) => void;
  errors?: ObraFormErrors;
  isEdit?: boolean;
  clientes: any[];
}) {
  const err = errors ?? {};
  return (
    <>
      <F label="Código *" error={err.codigo}>
        <Input
          value={state.codigo ?? ""}
          onChange={(e) => setState({ ...state, codigo: e.target.value })}
          aria-invalid={!!err.codigo}
        />
      </F>
      <F label="Nome *" error={err.nome}>
        <Input
          value={state.nome ?? ""}
          onChange={(e) => setState({ ...state, nome: e.target.value })}
          aria-invalid={!!err.nome}
        />
      </F>
      <F label="Cliente">
        <Select
          value={state.cliente_id ?? ""}
          onValueChange={(v) => {
            const c: any = (clientes ?? []).find((x: any) => x.id === v);
            setState({
              ...state,
              cliente_id: v,
              ...(isEdit
                ? {}
                : {
                    prazo_pagamento_dias:
                      state.prazo_pagamento_dias ?? c?.prazo_pagamento_dias ?? "",
                    dias_fixos_pagamento:
                      state.dias_fixos_pagamento ??
                      (Array.isArray(c?.dias_fixos_pagamento) && c.dias_fixos_pagamento.length
                        ? c.dias_fixos_pagamento
                        : c?.dia_fixo_pagamento
                          ? [c.dia_fixo_pagamento]
                          : []),
                    dias_ate_emissao_nf: state.dias_ate_emissao_nf ?? c?.prazo_emitir_nf_dias ?? 5,
                    prazo_emitir_nf_dias:
                      state.prazo_emitir_nf_dias ?? c?.prazo_emitir_nf_dias ?? "",
                    percentual_material: state.percentual_material ?? c?.percentual_material ?? "",
                    aliquota_iss: state.aliquota_iss ?? c?.aliquota_iss ?? "",
                    aliquota_inss: state.aliquota_inss ?? c?.aliquota_inss ?? "",
                    aliquota_cbs: state.aliquota_cbs ?? c?.aliquota_cbs ?? "",
                    aliquota_ibs: state.aliquota_ibs ?? c?.aliquota_ibs ?? "",
                  }),
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {(clientes ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </F>
      <F label="Pedido/Contrato">
        <Input
          value={state.pedido_contrato ?? ""}
          onChange={(e) => setState({ ...state, pedido_contrato: e.target.value })}
        />
      </F>
      <F label="Local">
        <Input
          value={state.local ?? ""}
          onChange={(e) => setState({ ...state, local: e.target.value })}
        />
      </F>
      {/* Cidade/UF alimentam o mapa de logística; `Local` segue livre para
          descrever o ponto exato dentro do município. */}
      <F label="Cidade / UF">
        <SeletorMunicipio
          cidade={state.cidade ?? ""}
          uf={state.uf ?? ""}
          onChange={({ cidade, uf }) => setState({ ...state, cidade, uf })}
        />
      </F>
      <F label="Centro de Custo TOTVS">
        <Input
          placeholder="Ex.: 01.002.0202"
          value={state.centro_custo_totvs ?? ""}
          onChange={(e) => setState({ ...state, centro_custo_totvs: e.target.value })}
        />
      </F>
      <F label="Valor do contrato (R$) *" error={err.valor_contrato}>
        <MoneyInput
          value={state.valor_contrato ?? null}
          onChange={(v) => setState({ ...state, valor_contrato: v ?? "" })}
          aria-invalid={!!err.valor_contrato}
        />
      </F>
      <F label="Antecipação / Mobilização (% do contrato)">
        <PercentInput
          value={
            state.percentual_antecipacao_input ??
            (() => {
              const vc = Number(state.valor_contrato || 0);
              const va = Number(state.valor_antecipacao || 0);
              return vc > 0 && va > 0 ? Number(((va / vc) * 100).toFixed(4)) : null;
            })()
          }
          onChange={(pct) => {
            const vc = Number(state.valor_contrato || 0);
            const valor = pct != null && vc > 0 ? Math.round((pct / 100) * vc * 100) / 100 : "";
            setState({
              ...state,
              percentual_antecipacao_input: pct ?? "",
              valor_antecipacao: valor,
            });
          }}
        />
        {(() => {
          const vc = Number(state.valor_contrato || 0);
          const va = Number(state.valor_antecipacao || 0);
          if (vc <= 0 || va <= 0) return null;
          return <p className="text-xs text-muted-foreground mt-1">= {brl(va)}</p>;
        })()}
      </F>
      <F label="Início">
        <Input
          type="date"
          value={state.data_inicio ?? ""}
          onChange={(e) => setState({ ...state, data_inicio: e.target.value })}
        />
      </F>
      <F label="Fim" error={err.data_fim}>
        <Input
          type="date"
          value={state.data_fim ?? ""}
          onChange={(e) => setState({ ...state, data_fim: e.target.value })}
          aria-invalid={!!err.data_fim}
        />
      </F>
      <F label="Previsão de término">
        <Input
          type="date"
          value={state.data_previsao_termino ?? ""}
          onChange={(e) => setState({ ...state, data_previsao_termino: e.target.value })}
        />
      </F>
      <F label="Regra de medição">
        <Input
          placeholder="ex: Dia 15, Dias 15 e 30, Mensal"
          value={state.regra_medicao ?? ""}
          onChange={(e) => setState({ ...state, regra_medicao: e.target.value })}
        />
      </F>
      <div className="col-span-2 pt-2 mt-2 border-t">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Régua de medição e pagamento
        </div>
      </div>
      <F label="Dias de corte da BMS">
        <ChipsNumberInput
          value={state.dias_corte_bms ?? []}
          onChange={(v) => setState({ ...state, dias_corte_bms: v })}
          placeholder="Ex.: 15, 30"
        />
      </F>
      <F label="Dias até emissão da NFS">
        <Input
          type="number"
          min={0}
          placeholder="5"
          value={state.dias_ate_emissao_nf ?? ""}
          onChange={(e) => setState({ ...state, dias_ate_emissao_nf: e.target.value })}
        />
      </F>
      <F label="Prazo pagamento (DDL)">
        <Input
          type="number"
          value={state.prazo_pagamento_dias ?? ""}
          onChange={(e) => setState({ ...state, prazo_pagamento_dias: e.target.value })}
        />
      </F>
      <F label="Dias fixos de pagamento">
        <ChipsNumberInput
          value={state.dias_fixos_pagamento ?? []}
          onChange={(v) => setState({ ...state, dias_fixos_pagamento: v })}
          placeholder="Ex.: 1, 15"
        />
      </F>
      <div className="col-span-2 pt-2 mt-2 border-t">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Retenções padrão (usadas como sugestão nas NFs)
        </div>
      </div>
      <F label="% Material" error={err.percentual_material}>
        <PercentInput
          value={state.percentual_material ?? null}
          onChange={(v) => setState({ ...state, percentual_material: v ?? "" })}
          placeholder="70,00"
        />
      </F>
      <F label="ISS" error={err.aliquota_iss}>
        <PercentInput
          value={state.aliquota_iss ?? null}
          onChange={(v) => setState({ ...state, aliquota_iss: v ?? "" })}
          placeholder="5,00"
        />
      </F>
      <F label="INSS" error={err.aliquota_inss}>
        <PercentInput
          value={state.aliquota_inss ?? null}
          onChange={(v) => setState({ ...state, aliquota_inss: v ?? "" })}
          placeholder="11,00"
        />
      </F>
      <F label="CBS" error={err.aliquota_cbs}>
        <PercentInput
          value={state.aliquota_cbs ?? null}
          onChange={(v) => setState({ ...state, aliquota_cbs: v ?? "" })}
          placeholder="0,00"
        />
      </F>
      <F label="IBS" error={err.aliquota_ibs}>
        <PercentInput
          value={state.aliquota_ibs ?? null}
          onChange={(v) => setState({ ...state, aliquota_ibs: v ?? "" })}
          placeholder="0,00"
        />
      </F>
      <div className="col-span-2">
        <F label="Observações">
          <Textarea
            value={state.observacoes ?? ""}
            onChange={(e) => setState({ ...state, observacoes: e.target.value })}
          />
        </F>
      </div>
    </>
  );
}

/** Mapeia uma linha de `obras` (DB) para o estado do form. */
export function obraToFormState(o: any) {
  return {
    codigo: o.codigo ?? "",
    nome: o.nome ?? "",
    cliente_id: o.cliente_id ?? "",
    pedido_contrato: o.pedido_contrato ?? "",
    centro_custo_totvs: o.centro_custo_totvs ?? "",
    local: o.local ?? "",
    cidade: o.cidade ?? "",
    uf: o.uf ?? "",
    valor_contrato: o.valor_contrato ?? "",
    valor_antecipacao: o.valor_antecipacao ?? "",
    data_inicio: o.data_inicio ?? "",
    data_fim: o.data_fim ?? "",
    data_previsao_termino: o.data_previsao_termino ?? "",
    regra_medicao: o.regra_medicao ?? "",
    prazo_emitir_nf_dias: o.prazo_emitir_nf_dias ?? "",
    dias_ate_emissao_nf: o.dias_ate_emissao_nf ?? 5,
    prazo_pagamento_dias: o.prazo_pagamento_dias ?? "",
    dias_corte_bms: Array.isArray(o.dias_corte_bms) ? o.dias_corte_bms : [],
    dias_fixos_pagamento: Array.isArray(o.dias_fixos_pagamento) ? o.dias_fixos_pagamento : [],
    percentual_material: o.percentual_material ?? "",
    aliquota_iss: o.aliquota_iss ?? "",
    aliquota_inss: o.aliquota_inss ?? "",
    aliquota_cbs: o.aliquota_cbs ?? "",
    aliquota_ibs: o.aliquota_ibs ?? "",
    observacoes: o.observacoes ?? "",
  };
}

/** Monta o payload para INSERT/UPDATE em `obras`. */
export function buildObraPayload(src: any) {
  return {
    cliente_id: src.cliente_id || null,
    codigo: src.codigo,
    nome: src.nome,
    pedido_contrato: src.pedido_contrato || null,
    centro_custo_totvs: src.centro_custo_totvs ? String(src.centro_custo_totvs).trim() : null,
    local: src.local || null,
    cidade: src.cidade || null,
    uf: src.uf || null,
    valor_contrato: Number(src.valor_contrato || 0),
    valor_antecipacao:
      src.valor_antecipacao != null && src.valor_antecipacao !== ""
        ? Number(src.valor_antecipacao)
        : null,
    data_inicio: src.data_inicio || null,
    data_fim: src.data_fim || null,
    data_previsao_termino: src.data_previsao_termino || null,
    regra_medicao: src.regra_medicao || null,
    prazo_emitir_nf_dias: src.prazo_emitir_nf_dias ? Number(src.prazo_emitir_nf_dias) : null,
    dias_ate_emissao_nf:
      src.dias_ate_emissao_nf != null && src.dias_ate_emissao_nf !== ""
        ? Number(src.dias_ate_emissao_nf)
        : 5,
    prazo_pagamento_dias: src.prazo_pagamento_dias ? Number(src.prazo_pagamento_dias) : null,
    dias_corte_bms: Array.isArray(src.dias_corte_bms) ? src.dias_corte_bms : [],
    dias_fixos_pagamento: Array.isArray(src.dias_fixos_pagamento) ? src.dias_fixos_pagamento : [],
    dia_fixo_pagamento:
      Array.isArray(src.dias_fixos_pagamento) && src.dias_fixos_pagamento.length
        ? src.dias_fixos_pagamento[0]
        : null,
    percentual_material:
      src.percentual_material != null && src.percentual_material !== ""
        ? Number(src.percentual_material)
        : 70,
    aliquota_iss:
      src.aliquota_iss != null && src.aliquota_iss !== "" ? Number(src.aliquota_iss) : 5,
    aliquota_inss:
      src.aliquota_inss != null && src.aliquota_inss !== "" ? Number(src.aliquota_inss) : 11,
    aliquota_cbs:
      src.aliquota_cbs != null && src.aliquota_cbs !== "" ? Number(src.aliquota_cbs) : 0,
    aliquota_ibs:
      src.aliquota_ibs != null && src.aliquota_ibs !== "" ? Number(src.aliquota_ibs) : 0,
    observacoes: src.observacoes || null,
  };
}
