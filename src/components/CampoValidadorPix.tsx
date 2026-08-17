import React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { useValidadorPix, type ValidadorState } from "@/hooks/financeiro/useValidadorPix";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
  tipoChave: string;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
}

const CONFIG: Record<
  ValidadorState,
  { icone: React.ReactNode | null; badgeClass: string; textClass: string; label: string }
> = {
  nao_iniciado: {
    icone: null,
    badgeClass: "border-border text-muted-foreground",
    textClass: "text-muted-foreground",
    label: "",
  },
  validando: {
    icone: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    badgeClass: "border-muted text-muted-foreground",
    textClass: "text-muted-foreground",
    label: "Validando",
  },
  valido: {
    icone: <CheckCircle2 className="h-3.5 w-3.5" />,
    badgeClass: "border-success/40 bg-success/10 text-success",
    textClass: "text-success",
    label: "Válida",
  },
  aviso: {
    icone: <AlertCircle className="h-3.5 w-3.5" />,
    badgeClass: "border-warning/40 bg-warning/10 text-warning",
    textClass: "text-warning",
    label: "Aviso",
  },
  invalido: {
    icone: <XCircle className="h-3.5 w-3.5" />,
    badgeClass: "border-destructive/40 bg-destructive/10 text-destructive",
    textClass: "text-destructive",
    label: "Inválida",
  },
  desabilitado: {
    icone: null,
    badgeClass: "border-muted text-muted-foreground",
    textClass: "text-muted-foreground",
    label: "Indisponível",
  },
};

const CampoValidadorPix: React.FC<Props> = ({
  value,
  onChange,
  tipoChave,
  disabled,
  label = "Nº da Chave Pix",
  placeholder = "Email, telefone, CPF ou aleatória",
  className,
}) => {
  const { validacao } = useValidadorPix(value, tipoChave);
  const cfg = CONFIG[validacao.state];

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      <div className="flex gap-2 items-start">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "flex-1 mt-1",
            validacao.state === "valido" && "border-success/50",
            validacao.state === "invalido" && "border-destructive/50",
            validacao.state === "aviso" && "border-warning/50",
          )}
        />
        {validacao.state !== "nao_iniciado" && cfg.label && (
          <Badge
            variant="outline"
            className={cn("mt-1 shrink-0 gap-1 px-2 py-1", cfg.badgeClass)}
          >
            {cfg.icone}
            <span className="text-[11px] font-medium">{cfg.label}</span>
          </Badge>
        )}
      </div>
      {(validacao.mensagem || validacao.detalhe) && validacao.state !== "nao_iniciado" && (
        <div className="space-y-0.5">
          {validacao.mensagem && (
            <p className={cn("text-xs font-medium", cfg.textClass)}>{validacao.mensagem}</p>
          )}
          {validacao.detalhe && (
            <p className={cn("text-xs", cfg.textClass, "opacity-80")}>{validacao.detalhe}</p>
          )}
          {validacao.titular && (
            <p className={cn("text-xs", cfg.textClass, "opacity-80")}>
              Titular: <strong>{validacao.titular}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CampoValidadorPix;
