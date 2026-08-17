import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fetchSnapshotAtivo } from "@/lib/financeiro-totvs/queries";
import { fmtData } from "@/lib/utils";

/**
 * Alerta sobre idade do snapshot TOTVS mais recente.
 * - Verde/silencioso: <= warnDays (default 3)
 * - Amarelo: entre warnDays e errorDays (default 7)
 * - Vermelho: > errorDays
 * Esconde quando nada foi importado ainda (deixa o vazio para a tela de Importar).
 */
export function SnapshotAgeAlert({
  warnDays = 3,
  errorDays = 7,
}: {
  warnDays?: number;
  errorDays?: number;
}) {
  const { data } = useQuery({
    queryKey: ["snapshot_ativo_age"],
    queryFn: fetchSnapshotAtivo,
    staleTime: 60_000,
  });

  if (!data?.importado_em) return null;

  const importadoEm = new Date(data.importado_em);
  const ageMs = Date.now() - importadoEm.getTime();
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

  if (ageDays < warnDays) return null;

  const isError = ageDays > errorDays;
  const variant = isError ? "destructive" : "default";
  const Icon = isError ? AlertTriangle : Clock;

  return (
    <Alert variant={variant} className="mb-4">
      <Icon className="h-4 w-4" />
      <AlertTitle>
        Snapshot TOTVS com {ageDays} dia{ageDays === 1 ? "" : "s"}
      </AlertTitle>
      <AlertDescription>
        Última importação: <strong>{fmtData(data.importado_em)}</strong>.{" "}
        {isError
          ? "Os valores financeiros podem estar desatualizados — importe um snapshot novo. "
          : "Considere importar um snapshot mais recente. "}
        <Link to="/financeiro/importar" className="underline font-medium">
          Ir para Importar
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}
