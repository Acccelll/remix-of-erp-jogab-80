import { Lock } from "lucide-react";

interface Props {
  /** Nome do módulo como aparece no Quadro de Permissões (ex.: "Financeiro"). */
  modulo: string;
  /** O que especificamente está bloqueado, em minúsculas e sem ponto final. */
  contexto: string;
}

/**
 * Aviso de módulo ausente. Existe para que uma área bloqueada **diga o que
 * falta** em vez de sumir da tela ou — pior — exibir zeros como se o dado
 * fosse real: quando as consultas são desligadas por falta de permissão, um
 * "R$ 0,00" mente sobre a obra.
 *
 * Use onde o gate é por MÓDULO (PageKey). Para negação de página inteira, o
 * painel de `RequireAccess` já cumpre esse papel.
 */
export function SemAcessoModulo({ modulo, contexto }: Props) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center text-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10"
    >
      <Lock className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">Requer o módulo {modulo}</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Você não tem acesso a {contexto}. Peça a um administrador (GM) a permissão de{" "}
        <strong>{modulo}</strong> no Quadro de Permissões.
      </p>
    </div>
  );
}

export default SemAcessoModulo;
