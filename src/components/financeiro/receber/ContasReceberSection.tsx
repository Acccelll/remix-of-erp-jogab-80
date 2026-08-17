import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/billing";
import { fmtData } from "@/lib/utils";
import { useContasReceberData } from "./useContasReceberData";

/**
 * Seção A Receber (natureza_tipo = 1 / CR).
 * Reaproveita view/rollup do Fluxo de Dívidas — apenas com o filtro
 * invertido de natureza. Layout minimalista, alinhado ao card padrão
 * do Fluxo de Dívidas.
 */
export function ContasReceberSection({ obraId }: { obraId?: string }) {
  const { data, hoje } = useContasReceberData(obraId ?? "all");

  const vencido = data?.vencido ?? { titulos: 0, valor: 0 };
  const hojeB = data?.hoje ?? { titulos: 0, valor: 0 };
  const avencer = data?.avencer ?? { titulos: 0, valor: 0 };
  const recebido = data?.recebido ?? { titulos: 0, valor: 0 };
  const totalAberto = data?.totalAberto ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          A Receber (TOTVS) ·{" "}
          <span className="text-xs font-normal text-muted-foreground">Hoje: {fmtData(hoje)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <BucketCard label="Vencido" bucket={vencido} tone="danger" />
          <BucketCard label="Vencendo hoje" bucket={hojeB} tone="warn" />
          <BucketCard label="A vencer" bucket={avencer} tone="neutral" />
          <BucketCard label="Recebido" bucket={recebido} tone="success" />
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Total em aberto:{" "}
          <strong className="text-foreground">{brl(totalAberto)}</strong>
        </div>
      </CardContent>
    </Card>
  );
}

function BucketCard({
  label,
  bucket,
  tone,
}: {
  label: string;
  bucket: { titulos: number; valor: number };
  tone: "danger" | "warn" | "neutral" | "success";
}) {
  const cls =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${cls}`}>{brl(bucket.valor)}</div>
      <div className="text-xs text-muted-foreground mt-1">{bucket.titulos} título(s)</div>
    </div>
  );
}
