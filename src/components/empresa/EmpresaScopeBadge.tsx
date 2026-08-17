// UX-004 — Sinalização de escopo multiempresa por tela.
// Componente transversal renderizado junto do Breadcrumb: torna explícito
// qual empresa (ou "Todas") está filtrando os dados exibidos. Sem esta
// sinalização, o usuário via listas mudarem "misteriosamente" ao trocar
// empresa no selector do header (Achado UX-004, Etapa 2/3 da Auditoria).
//
// Regras:
// - Esconde-se para usuários com apenas 1 empresa e sem privilégio GM
//   (não há ambiguidade de escopo — corresponde ao comportamento do
//   EmpresaSelector no header).
// - GM vendo "Todas as empresas" recebe destaque visual (variante warning)
//   porque nenhum filtro está aplicado — decisão consciente da Onda 0.

import { Building2, Globe2 } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/auth/useAuth";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export function EmpresaScopeBadge() {
  const { empresas, empresaAtualId, empresaAtual, carregando } = useEmpresa();
  const { currentPlayer } = useAuth();
  const isGm = !!currentPlayer?.isGM;

  if (carregando) return null;
  if (!isGm && empresas.length <= 1) return null;
  if (empresas.length === 0 && !isGm) return null;

  const isTodas = empresaAtualId === null;
  const nome = isTodas
    ? "Todas as empresas"
    : empresaAtual?.nome_fantasia || empresaAtual?.razao_social || "Empresa";

  const Icon = isTodas ? Globe2 : Building2;
  const variant = isTodas ? "outline" : "secondary";
  const tooltip = isTodas
    ? "Nenhum filtro de empresa aplicado — dados de todas as empresas visíveis a você (GM). Troque no seletor do topo para escopar."
    : `Dados filtrados pela empresa: ${nome}. Troque no seletor do topo para outra empresa.`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className={`gap-1.5 h-6 px-2 text-[11px] font-medium border ${
              isTodas ? "border-warning/40 text-warning" : ""
            }`}
            aria-label={`Escopo atual: ${nome}`}
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-[180px]">Escopo: {nome}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
