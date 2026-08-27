/**
 * Portal de Campo — RDO. Reaproveita `RdoTab` (já offline-first,
 * `src/lib/offline/`) direto — nasceu standalone (só precisa de `obraId`),
 * então não precisou de nenhuma adaptação pra rodar fora da Obra 360.
 */
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RdoTab } from "@/components/obra/RdoTab";

export default function CampoRdo() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const obraId = params.get("obra");

  if (!obraId) return <Navigate to="/campo" replace />;

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => navigate("/campo")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      <RdoTab obraId={obraId} />
    </div>
  );
}
