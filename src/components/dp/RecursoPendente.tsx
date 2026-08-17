// Aviso de recurso de Ponto ainda não publicado no host.
//
// O frontend é implantado independentemente do `api.php` e das migrations do MySQL;
// entre um deploy e outro há uma janela em que a tela pede algo que o backend ainda
// não tem. Em vez de erro de SQL cru, mostra o que falta aplicar.
import { Card } from "@/components/ui/card";
import { DatabaseZap } from "lucide-react";
import type { RecursoIndisponivelError } from "@/lib/ponto/disponibilidade";

interface Props {
  erro: RecursoIndisponivelError;
  /** Migração que libera o recurso, quando o que falta é estrutura de banco. */
  migracao?: string;
  /** O que a aba passa a mostrar depois de aplicada — ajuda a priorizar. */
  descricao?: string;
}

export default function RecursoPendente({ erro, migracao, descricao }: Props) {
  const passo =
    erro.motivo === "rota"
      ? "Publicar a versão atual do `api.php` no host."
      : migracao
        ? `Aplicar a migração \`migrations/${migracao}\` com \`ops/mysql-migrate.sh\`.`
        : "Aplicar a migração pendente do MySQL.";

  return (
    <Card className="p-6 flex flex-col items-center gap-3 text-center">
      <DatabaseZap className="w-6 h-6 text-muted-foreground" />
      <div className="space-y-1">
        <div className="font-medium">Recurso ainda não disponível neste ambiente</div>
        <p className="text-sm text-muted-foreground max-w-xl">{erro.message}</p>
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">Para liberar: </span>
        <span className="font-mono text-xs">{passo}</span>
      </div>
      {descricao && <p className="text-xs text-muted-foreground max-w-xl">{descricao}</p>}
    </Card>
  );
}
