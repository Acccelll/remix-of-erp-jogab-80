/** @module-kind pure */
// Detecção de recurso de Ponto ainda não disponível no host.
//
// O backend PHP e as migrations do MySQL são aplicados pelo operador, em deploys
// separados do frontend. Entre um e outro existe uma janela em que a tela já pede um
// endpoint/tabela que o host ainda não tem. Sem tratamento, essa janela vira erro de
// SQL cru na cara do usuário; com ele, vira um aviso dizendo exatamente o que falta.
//
// Dois sintomas distintos:
//  - **rota ausente**: `api.php` responde 200 com `{"message": "…Recurso não encontrado."}`
//    no `default` do switch, em vez do array esperado;
//  - **tabela/coluna ausente**: PDOException vira 500 com a mensagem do MySQL
//    (`42S02`, "Base table or view not found", "Unknown column").

export type MotivoIndisponivel = "rota" | "schema";

export class RecursoIndisponivelError extends Error {
  constructor(
    readonly recurso: string,
    readonly motivo: MotivoIndisponivel,
    readonly detalhe?: string,
  ) {
    super(
      motivo === "rota"
        ? `A rota "${recurso}" ainda não existe no api.php publicado.`
        : `A estrutura de banco usada por "${recurso}" ainda não foi migrada.`,
    );
    this.name = "RecursoIndisponivelError";
  }
}

export function isRecursoIndisponivel(err: unknown): err is RecursoIndisponivelError {
  return err instanceof RecursoIndisponivelError;
}

/**
 * `true` quando a resposta é o "recurso não encontrado" do `default` do api.php —
 * um objeto com `message` onde a rota, se existisse, devolveria um array.
 */
export function respostaDeRotaAusente(data: unknown): boolean {
  if (Array.isArray(data) || data === null || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.message === "string" && !("error" in obj);
}

const PADROES_SCHEMA = [
  /42S02/i,
  /base table or view not found/i,
  /doesn'?t exist/i,
  /unknown column/i,
  /no such table/i,
];

/** `true` quando o erro veio de tabela/coluna que a migration ainda não criou. */
export function ehErroDeSchema(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!msg) return false;
  return PADROES_SCHEMA.some((re) => re.test(msg));
}
