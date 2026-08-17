/**
 * Contratos de Fornecimento — lista + medições.
 * Página acessada via aba "Fornecimento" do ContratosHub.
 */
import React, { useMemo, useState } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useObrasContext } from "@/contexts/ObrasContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Ruler } from "lucide-react";
import {
  acumuladoMedido,
  valorTotalContrato,
  saldoContrato,
  validarNovaMedicao,
  percentualParaValor,
  MedicaoError,
} from "@/lib/contratos/medicao";
import { formatBRL } from "@/lib/core/currency";
import {
  useContratosFornecimento,
  useContratoFornecedores,
  useContratoMedicoes,
  useContratoAditivos,
  useCreateContratoFornecimento,
  useCreateContratoMedicao,
  type ContratoFornecimento,
} from "@/hooks/contratos/useContratosFornecimento";

type Contrato = ContratoFornecimento;

const brl = (n: number) => formatBRL(n);

export default function ContratosFornecimento() {
  const { obras } = useObrasContext();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("contratos", "editar");

  const { data: contratos = [] } = useContratosFornecimento();
  const { data: fornecedores = [] } = useContratoFornecedores();
  const contratoIds = useMemo(() => contratos.map((c) => c.id), [contratos]);
  const { data: medicoes = {} } = useContratoMedicoes(contratoIds);
  const { data: aditivos = {} } = useContratoAditivos(contratoIds);
  const createContrato = useCreateContratoFornecimento();
  const createMedicao = useCreateContratoMedicao();

  const [filtroObra, setFiltroObra] = useState<string>("__all__");
  const [novoOpen, setNovoOpen] = useState(false);
  const [medOpen, setMedOpen] = useState<string | null>(null);

  // Form novo contrato
  const [nObra, setNObra] = useState("");
  const [nForn, setNForn] = useState<string>("");
  const [nNum, setNNum] = useState("");
  const [nObj, setNObj] = useState("");
  const [nTipo, setNTipo] = useState<"material" | "servico" | "mao_obra">("material");
  const [nValor, setNValor] = useState("");
  const [nIni, setNIni] = useState("");
  const [nFim, setNFim] = useState("");

  // Form medição
  const [mData, setMData] = useState(() => new Date().toISOString().slice(0, 10));
  const [mPerc, setMPerc] = useState("");
  const [mValor, setMValor] = useState("");
  const [mObs, setMObs] = useState("");

  const filtrados = useMemo(
    () =>
      filtroObra === "__all__" ? contratos : contratos.filter((c) => c.obra_id === filtroObra),
    [contratos, filtroObra],
  );

  const criarContrato = async () => {
    if (!nObra || !nNum || !nObj || !Number(nValor))
      return toast.error("Preencha obra, número, objeto e valor");
    try {
      await createContrato.mutateAsync({
        obra_id: nObra,
        fornecedor_id: nForn || null,
        numero: nNum,
        objeto: nObj,
        tipo: nTipo,
        valor: Number(nValor),
        data_inicio: nIni || null,
        data_fim: nFim || null,
      });
    } catch (error: any) {
      return toast.error(error?.message ?? "Erro ao criar contrato");
    }
    toast.success("Contrato criado");
    setNovoOpen(false);
    setNObra("");
    setNForn("");
    setNNum("");
    setNObj("");
    setNValor("");
    setNIni("");
    setNFim("");
  };

  const criarMedicao = async () => {
    if (!medOpen) return;
    const c = contratos.find((x) => x.id === medOpen);
    if (!c) return;
    const valor = Number(mValor || 0);
    if (!valor) return toast.error("Valor obrigatório");
    try {
      validarNovaMedicao(c, medicoes[c.id] || [], aditivos[c.id] || [], {
        valor,
        status: "aprovada",
      });
    } catch (err) {
      if (err instanceof MedicaoError) return toast.error(err.message);
      throw err;
    }
    try {
      await createMedicao.mutateAsync({
        contrato_id: c.id,
        data_corte: mData,
        percentual: Number(mPerc) || 0,
        valor,
        observacao: mObs || null,
        status: "aprovada",
      });
    } catch (error: any) {
      return toast.error(error?.message ?? "Erro ao registrar medição");
    }
    toast.success("Medição registrada");
    setMedOpen(null);
    setMPerc("");
    setMValor("");
    setMObs("");
  };

  const obraNome = (id: string) => obras.find((o) => o.id === id)?.nome || id;
  const fornNome = (id: string | null) =>
    id ? fornecedores.find((f) => f.id === id)?.nome || id : "—";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display text-xl">Contratos de Fornecimento</h2>
        <div className="flex items-center gap-2">
          <Select value={filtroObra} onValueChange={setFiltroObra}>
            <SelectTrigger className="w-56 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as obras</SelectItem>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && (
            <Button size="sm" onClick={() => setNovoOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo contrato
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtrados.map((c) => {
          const meds = medicoes[c.id] || [];
          const adits = aditivos[c.id] || [];
          const total = valorTotalContrato(c, adits);
          const acum = acumuladoMedido(meds);
          const saldo = saldoContrato(c, meds, adits);
          const pct = total > 0 ? (acum / total) * 100 : 0;
          return (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {c.numero} · {c.objeto}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {obraNome(c.obra_id)} · {fornNome(c.fornecedor_id)}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {c.tipo}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Total</div>
                    <div className="font-semibold">{brl(total)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Medido</div>
                    <div className="font-semibold">{brl(acum)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Saldo</div>
                    <div className="font-semibold">{brl(saldo)}</div>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                  <span>
                    {pct.toFixed(1)}% medido · {meds.length} medições
                  </span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setMedOpen(c.id);
                        const v = percentualParaValor(c, adits, 0);
                        setMValor("");
                        setMPerc("");
                        setMObs("");
                      }}
                    >
                      <Ruler className="h-3 w-3 mr-1" /> Medir
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtrados.length === 0 && (
          <div className="text-sm text-muted-foreground col-span-full text-center py-12">
            Nenhum contrato de fornecimento cadastrado.
          </div>
        )}
      </div>

      {/* Dialog Novo contrato */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo contrato</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <div>
              <Label className="text-xs">Obra</Label>
              <Select value={nObra} onValueChange={setNObra}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
              <Label className="text-xs">Fornecedor</Label>
              <Select
                value={nForn || "__none__"}
                onValueChange={(v) => setNForn(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem fornecedor</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Número</Label>
                <Input value={nNum} onChange={(e) => setNNum(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={nTipo} onValueChange={(v: any) => setNTipo(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="mao_obra">Mão de obra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Objeto</Label>
              <Input value={nObj} onChange={(e) => setNObj(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={nValor}
                  onChange={(e) => setNValor(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <DatePickerField value={nIni} onChange={(v) => setNIni(v)} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <DatePickerField value={nFim} onChange={(v) => setNFim(v)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criarContrato}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Medição */}
      <Dialog open={medOpen !== null} onOpenChange={(v) => !v && setMedOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova medição</DialogTitle>
          </DialogHeader>
          {medOpen &&
            (() => {
              const c = contratos.find((x) => x.id === medOpen)!;
              const adits = aditivos[c.id] || [];
              const total = valorTotalContrato(c, adits);
              const acum = acumuladoMedido(medicoes[c.id] || []);
              const saldoRest = total - acum;
              return (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Saldo disponível:{" "}
                    <span className="font-medium text-foreground">{brl(saldoRest)}</span>
                  </div>
                  <div>
                    <Label className="text-xs">Data de corte</Label>
                    <DatePickerField value={mData} onChange={(v) => setMData(v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Percentual (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={mPerc}
                        onChange={(e) => {
                          setMPerc(e.target.value);
                          const v = percentualParaValor(c, adits, Number(e.target.value) || 0);
                          setMValor(v.toFixed(2));
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={mValor}
                        onChange={(e) => setMValor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Observação</Label>
                    <Input value={mObs} onChange={(e) => setMObs(e.target.value)} />
                  </div>
                </div>
              );
            })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMedOpen(null)}>
              Cancelar
            </Button>
            <Button onClick={criarMedicao}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
