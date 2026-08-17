import React, { useEffect, useState } from "react";
import { frotaAbastecimentosRepo, frotaManutencoesRepo } from "@/lib/repositories/frotas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useObrasContext } from "@/contexts/ObrasContext";
import { formatBRL } from "@/lib/core/currency";
import { QueryState } from "@/components/common/QueryState";

type AtivoTipo = "veiculo" | "patrimonio";

interface Props {
  ativoTipo: AtivoTipo;
  ativoId: string;
  obraAtualId?: string | null;
}

interface Abast {
  id: string;
  data: string;
  litros: number;
  valor: number;
  odometro: number | null;
  horimetro: number | null;
  obra_id: string | null;
  combustivel: string | null;
  posto: string | null;
  observacao: string | null;
}

interface Manut {
  id: string;
  data: string;
  tipo: string;
  valor: number;
  descricao: string | null;
  fornecedor: string | null;
  horimetro: number | null;
  proxima_preventiva_horimetro: number | null;
  obra_id: string | null;
}

const FrotaCustosTabs: React.FC<Props> = ({ ativoTipo, ativoId, obraAtualId }) => {
  const { obras } = useObrasContext();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("frotas", "editar");
  const idCol = ativoTipo === "veiculo" ? "veiculo_id" : "patrimonio_id";

  const [abast, setAbast] = useState<Abast[]>([]);
  const [manut, setManut] = useState<Manut[]>([]);
  const [loading, setLoading] = useState(false);

  // Form abastecimento
  const [aData, setAData] = useState(() => new Date().toISOString().slice(0, 10));
  const [aLitros, setALitros] = useState("");
  const [aValor, setAValor] = useState("");
  const [aOdom, setAOdom] = useState("");
  const [aHorim, setAHorim] = useState("");
  const [aObra, setAObra] = useState<string>(obraAtualId || "");

  // Form manutenção
  const [mData, setMData] = useState(() => new Date().toISOString().slice(0, 10));
  const [mTipo, setMTipo] = useState<"preventiva" | "corretiva">("preventiva");
  const [mValor, setMValor] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mProx, setMProx] = useState("");
  const [mObra, setMObra] = useState<string>(obraAtualId || "");

  const load = async () => {
    setLoading(true);
    const [a, m] = await Promise.all([
      frotaAbastecimentosRepo.listByAtivo(idCol as any, ativoId),
      frotaManutencoesRepo.listByAtivo(idCol as any, ativoId),
    ]);
    setAbast(a as any);
    setManut(m as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativoId]);

  const submitAbast = async () => {
    const litros = Number(aLitros);
    const valor = Number(aValor);
    if (!litros || litros <= 0) return toast.error("Litros obrigatório");
    if (valor < 0) return toast.error("Valor inválido");
    try {
      await frotaAbastecimentosRepo.create({
        [idCol]: ativoId,
        data: aData,
        litros,
        valor,
        odometro: aOdom ? Number(aOdom) : null,
        horimetro: aHorim ? Number(aHorim) : null,
        obra_id: aObra || null,
      });
    } catch (e: any) {
      return toast.error(e?.message ?? "Erro ao registrar");
    }
    toast.success("Abastecimento registrado");
    setALitros("");
    setAValor("");
    setAOdom("");
    setAHorim("");
    load();
  };

  const submitManut = async () => {
    const valor = Number(mValor || 0);
    if (valor < 0) return toast.error("Valor inválido");
    try {
      await frotaManutencoesRepo.create({
        [idCol]: ativoId,
        data: mData,
        tipo: mTipo,
        valor,
        descricao: mDesc || null,
        proxima_preventiva_horimetro: mProx ? Number(mProx) : null,
        obra_id: mObra || null,
      });
    } catch (e: any) {
      return toast.error(e?.message ?? "Erro ao registrar");
    }
    toast.success("Manutenção registrada");
    setMValor("");
    setMDesc("");
    setMProx("");
    load();
  };

  const obraNome = (id: string | null) => (id ? obras.find((o) => o.id === id)?.nome || id : "—");
  const brl = (n: number) => formatBRL(n);

  return (
    <Tabs defaultValue="abast" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="abast" className="flex-1 text-xs">
          Abastecimento
        </TabsTrigger>
        <TabsTrigger value="manut" className="flex-1 text-xs">
          Manutenção
        </TabsTrigger>
      </TabsList>

      <TabsContent value="abast" className="space-y-3 pt-2">
        {canEdit && (
          <div className="grid grid-cols-2 gap-2 p-2 rounded-md border bg-muted/30">
            <div className="col-span-2">
              <Label className="text-xs">Data</Label>
              <DatePickerField
                value={aData}
                onChange={(v) => setAData(v)}
                inputClassName="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Litros</Label>
              <Input
                type="number"
                step="0.01"
                value={aLitros}
                onChange={(e) => setALitros(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={aValor}
                onChange={(e) => setAValor(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Odômetro</Label>
              <Input
                type="number"
                value={aOdom}
                onChange={(e) => setAOdom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Horímetro</Label>
              <Input
                type="number"
                value={aHorim}
                onChange={(e) => setAHorim(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Obra</Label>
              <Select
                value={aObra || "__none__"}
                onValueChange={(v) => setAObra(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Sem obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem obra</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="col-span-2" onClick={submitAbast}>
              Registrar
            </Button>
          </div>
        )}
        <div className="space-y-1 max-h-60 overflow-y-auto">
          <QueryState
            isLoading={loading}
            data={abast}
            isEmpty={(r) => r.length === 0}
            empty={<div className="text-xs text-muted-foreground">Sem registros.</div>}
          >
            {(rows) => (
              <>
                {rows.map((r) => (
                  <div key={r.id} className="text-xs p-2 rounded border bg-card">
                    <div className="flex justify-between">
                      <span>{r.data.split("-").reverse().join("/")}</span>
                      <span className="font-medium">{brl(Number(r.valor))}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {Number(r.litros)} L · {obraNome(r.obra_id)}
                    </div>
                  </div>
                ))}
              </>
            )}
          </QueryState>
        </div>
      </TabsContent>

      <TabsContent value="manut" className="space-y-3 pt-2">
        {canEdit && (
          <div className="grid grid-cols-2 gap-2 p-2 rounded-md border bg-muted/30">
            <div>
              <Label className="text-xs">Data</Label>
              <DatePickerField
                value={mData}
                onChange={(v) => setMData(v)}
                inputClassName="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={mTipo} onValueChange={(v: any) => setMTipo(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="corretiva">Corretiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={mValor}
                onChange={(e) => setMValor(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Próx. preventiva (h)</Label>
              <Input
                type="number"
                value={mProx}
                onChange={(e) => setMProx(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Input
                value={mDesc}
                onChange={(e) => setMDesc(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Obra</Label>
              <Select
                value={mObra || "__none__"}
                onValueChange={(v) => setMObra(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Sem obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem obra</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="col-span-2" onClick={submitManut}>
              Registrar
            </Button>
          </div>
        )}
        <div className="space-y-1 max-h-60 overflow-y-auto">
          <QueryState
            isLoading={loading}
            data={manut}
            isEmpty={(r) => r.length === 0}
            empty={<div className="text-xs text-muted-foreground">Sem registros.</div>}
          >
            {(rows) => (
              <>
                {rows.map((r) => (
                  <div key={r.id} className="text-xs p-2 rounded border bg-card">
                    <div className="flex justify-between">
                      <span>
                        {r.data.split("-").reverse().join("/")} · {r.tipo}
                      </span>
                      <span className="font-medium">{brl(Number(r.valor))}</span>
                    </div>
                    {r.descricao && <div className="text-muted-foreground">{r.descricao}</div>}
                    <div className="text-muted-foreground">{obraNome(r.obra_id)}</div>
                  </div>
                ))}
              </>
            )}
          </QueryState>
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default FrotaCustosTabs;
