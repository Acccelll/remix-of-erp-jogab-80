/**
 * PRO-031 · slice-02 — Diálogo de parametrização por empresa.
 *
 * Consumo direto do repositório local `empresaParametrizacaoRepo`
 * (slice-01). Sem persistência remota; sem consumidores (RDO/Medição
 * seguem com suas numerações). Acesso restrito ao GM via chamador.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Separator } from "@/components/ui/separator";
import {
  DEFAULT_NUMERACAO,
  type DadosInstitucionaisEmpresa,
  type EmpresaParametrizacao,
  type NumeracaoConfig,
  type TipoDocumentoNumeravel,
  empresaParametrizacaoRepo,
  formatarNumero,
  resolverConfig,
} from "@/lib/empresa/parametrizacao";

const TIPOS: { key: TipoDocumentoNumeravel; label: string }[] = [
  { key: "rdo", label: "RDO" },
  { key: "medicao", label: "Medição" },
  { key: "nota_fiscal", label: "Nota fiscal" },
  { key: "requisicao", label: "Requisição" },
  { key: "contrato", label: "Contrato" },
  { key: "cotacao", label: "Cotação" },
  { key: "ordem_compra", label: "Ordem de compra" },
];

interface Props {
  empresaId: string | null;
  empresaNome?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EmpresaParametrizacaoDialog({
  empresaId,
  empresaNome,
  open,
  onOpenChange,
}: Props) {
  const [state, setState] = useState<EmpresaParametrizacao | null>(null);

  useEffect(() => {
    if (!open || !empresaId) return;
    setState(empresaParametrizacaoRepo.get(empresaId));
  }, [open, empresaId]);

  const numeracoes = useMemo(() => {
    if (!state) return {} as Record<TipoDocumentoNumeravel, NumeracaoConfig>;
    return TIPOS.reduce(
      (acc, t) => {
        acc[t.key] = resolverConfig(state, t.key);
        return acc;
      },
      {} as Record<TipoDocumentoNumeravel, NumeracaoConfig>,
    );
  }, [state]);

  function updateNum(tipo: TipoDocumentoNumeravel, patch: Partial<NumeracaoConfig>) {
    setState((prev) => {
      if (!prev) return prev;
      const atual = resolverConfig(prev, tipo);
      return {
        ...prev,
        numeracoes: { ...prev.numeracoes, [tipo]: { ...atual, ...patch } },
      };
    });
  }

  function reset(tipo: TipoDocumentoNumeravel) {
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev.numeracoes };
      delete next[tipo];
      return { ...prev, numeracoes: next };
    });
  }

  function salvar() {
    if (!state) return;
    empresaParametrizacaoRepo.save(state);
    toast.success("Parametrização salva");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Parametrização{empresaNome ? ` · ${empresaNome}` : ""}
          </DialogTitle>
        </DialogHeader>

        {state && (
          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            <section className="space-y-2">
              <Label>Logotipo (URL)</Label>
              <Input
                placeholder="https://…/logo.png"
                value={state.logoUrl ?? ""}
                onChange={(e) =>
                  setState({ ...state, logoUrl: e.target.value || null })
                }
              />
              {state.logoUrl && (
                <img
                  src={state.logoUrl}
                  alt="Prévia do logotipo"
                  className="h-12 w-auto rounded border bg-muted p-1 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Usado em cabeçalhos de relatórios e impressões da empresa.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <div>
                <Label className="text-sm">Dados institucionais</Label>
                <p className="text-xs text-muted-foreground">
                  Exibidos no cabeçalho de PDFs formais (razão social, CNPJ, contato).
                </p>
              </div>
              {(
                [
                  ["razaoSocial", "Razão social", "Ex.: Cappucceno Engenharia LTDA"],
                  ["cnpj", "CNPJ", "00.000.000/0000-00"],
                  ["endereco", "Endereço", "Rua, nº — Bairro — Cidade/UF"],
                  ["telefone", "Telefone", "(00) 0000-0000"],
                  ["email", "E-mail", "contato@empresa.com.br"],
                  ["site", "Site", "https://empresa.com.br"],
                ] as [keyof DadosInstitucionaisEmpresa, string, string][]
              ).map(([key, label, placeholder]) => (
                <div key={key} className="grid grid-cols-[110px_1fr] items-center gap-2">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    className="h-8"
                    placeholder={placeholder}
                    value={state.institucional?.[key] ?? ""}
                    onChange={(e) =>
                      setState({
                        ...state,
                        institucional: {
                          ...(state.institucional ?? {}),
                          [key]: e.target.value || undefined,
                        },
                      })
                    }
                  />
                </div>
              ))}
            </section>

            <Separator />

            <section className="space-y-3">
              <div>
                <Label className="text-sm">Numeração por documento</Label>
                <p className="text-xs text-muted-foreground">
                  Prefixo, padding e próximo número. Vazio usa o padrão global.
                </p>
              </div>

              <div className="space-y-3">
                {TIPOS.map((t) => {
                  const cfg = numeracoes[t.key];
                  const isDefault = !state.numeracoes[t.key];
                  return (
                    <div
                      key={t.key}
                      className="grid grid-cols-[110px_1fr_90px_110px_auto] items-end gap-2"
                    >
                      <div>
                        <Label className="text-xs">{t.label}</Label>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {formatarNumero(cfg, cfg.proximo)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-[10px]">Prefixo</Label>
                        <Input
                          className="h-8"
                          value={cfg.prefixo}
                          onChange={(e) =>
                            updateNum(t.key, { prefixo: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Padding</Label>
                        <Input
                          className="h-8"
                          type="number"
                          min={1}
                          max={12}
                          value={cfg.padding}
                          onChange={(e) =>
                            updateNum(t.key, {
                              padding: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Próximo</Label>
                        <Input
                          className="h-8"
                          type="number"
                          min={1}
                          value={cfg.proximo}
                          onChange={(e) =>
                            updateNum(t.key, {
                              proximo: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isDefault}
                        onClick={() => reset(t.key)}
                        title={
                          isDefault
                            ? `Usando padrão (${DEFAULT_NUMERACAO[t.key].prefixo})`
                            : "Restaurar padrão"
                        }
                      >
                        Padrão
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!state}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
