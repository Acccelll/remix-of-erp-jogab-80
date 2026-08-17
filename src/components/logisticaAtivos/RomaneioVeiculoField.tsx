import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVeiculosContext } from "@/contexts/VeiculosContext";
import { useSetVeiculoTransportador } from "@/hooks/logisticaAtivos/useRomaneios";

interface Props {
  romaneioId: string;
  veiculoTransportadorId: string | null;
  mobilizarVeiculo: boolean;
  editavel: boolean;
}

export default function RomaneioVeiculoField({
  romaneioId,
  veiculoTransportadorId,
  mobilizarVeiculo,
  editavel,
}: Props) {
  const { veiculos } = useVeiculosContext();
  const setVeiculo = useSetVeiculoTransportador();
  const ativos = veiculos.filter((v) => v.ativo);

  function onVeiculoChange(veiculoId: string) {
    setVeiculo.mutate({ romaneioId, veiculoId: veiculoId || null, mobilizar: mobilizarVeiculo });
  }

  function onMobilizarChange(checked: boolean) {
    setVeiculo.mutate({ romaneioId, veiculoId: veiculoTransportadorId, mobilizar: checked });
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Veículo transportador</Label>
      <div className="flex items-center gap-3">
        <Select
          value={veiculoTransportadorId ?? ""}
          onValueChange={onVeiculoChange}
          disabled={!editavel}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            {ativos.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.codigo} — {v.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={mobilizarVeiculo}
            onCheckedChange={(v) => onMobilizarChange(Boolean(v))}
            disabled={!editavel || !veiculoTransportadorId}
          />
          Mobilizar este veículo junto
        </label>
      </div>
    </div>
  );
}
