import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  severidadeToken,
  SEVERIDADE_LABEL,
  type SeveridadeOuAtraso,
} from "@/lib/qualidade/severidade";
import { AlertTriangle, AlertCircle, Info, ShieldAlert, Clock } from "lucide-react";

const ICON: Record<SeveridadeOuAtraso, typeof Info> = {
  baixa: Info,
  media: AlertCircle,
  alta: AlertTriangle,
  critica: ShieldAlert,
  atraso: Clock,
};

/**
 * Badge de severidade com token semântico + ícone + rótulo textual.
 * Cor NÃO é o único meio de comunicar gravidade (a11y).
 */
export function BadgeSeveridade({
  severidade,
  className,
  showIcon = true,
  children,
}: {
  severidade: SeveridadeOuAtraso;
  className?: string;
  showIcon?: boolean;
  children?: React.ReactNode;
}) {
  const t = severidadeToken(severidade);
  const Icon = ICON[severidade];
  const label = SEVERIDADE_LABEL[severidade];
  return (
    <Badge
      variant="outline"
      className={cn(t.className, "gap-1", className)}
      aria-label={`Severidade ${label}`}
    >
      {showIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      <span>{children ?? label}</span>
    </Badge>
  );
}
