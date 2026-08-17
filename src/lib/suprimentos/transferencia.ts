/** @module-kind pure */
/**
 * Transferência de estoque entre locais (lógica pura).
 *
 * Aplicada antes da chamada à RPC `fn_estoque_transferir` no servidor. A RPC
 * é a fonte da verdade (transação atômica + RLS); esta lib só existe para
 * pré-validar na UI e para ser testável sem rede.
 */

export interface SaldoLocal {
  local: string;
  insumo_id: string;
  saldo: number;
}

export interface MovimentacaoPlano {
  local: string;
  insumo_id: string;
  tipo: "saida" | "entrada";
  quantidade: number;
  origem: string;
}

export interface TransferenciaResult {
  saldosAtualizados: SaldoLocal[];
  movimentacoes: [MovimentacaoPlano, MovimentacaoPlano];
}

export interface TransferenciaInput {
  saldos: ReadonlyArray<SaldoLocal>;
  insumo_id: string;
  origem: string;
  destino: string;
  quantidade: number;
  /** uuid de correlação; default crypto.randomUUID() quando disponível. */
  ref?: string;
}

export class TransferenciaError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function randomRef(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function aplicarTransferencia({
  saldos,
  insumo_id,
  origem,
  destino,
  quantidade,
  ref,
}: TransferenciaInput): TransferenciaResult {
  if (!insumo_id) throw new TransferenciaError("insumo_obrigatorio", "Insumo obrigatório");
  if (!origem || !destino) {
    throw new TransferenciaError("locais_obrigatorios", "Origem e destino obrigatórios");
  }
  if (origem === destino) {
    throw new TransferenciaError("locais_iguais", "Origem e destino devem ser diferentes");
  }
  if (!(quantidade > 0)) {
    throw new TransferenciaError("qtd_invalida", "Quantidade deve ser maior que zero");
  }

  const saldoOrigem = saldos.find((s) => s.local === origem && s.insumo_id === insumo_id);
  const saldoOrigemAtual = Number(saldoOrigem?.saldo ?? 0);
  if (saldoOrigemAtual < quantidade) {
    throw new TransferenciaError(
      "saldo_insuficiente",
      `Saldo insuficiente no local de origem (disponível: ${saldoOrigemAtual})`,
    );
  }

  const saldoDestino = saldos.find((s) => s.local === destino && s.insumo_id === insumo_id);
  const saldoDestinoAtual = Number(saldoDestino?.saldo ?? 0);

  const saldosAtualizados: SaldoLocal[] = [];
  let inseriuOrigem = false;
  let inseriuDestino = false;
  for (const s of saldos) {
    if (s.insumo_id === insumo_id && s.local === origem) {
      saldosAtualizados.push({ ...s, saldo: saldoOrigemAtual - quantidade });
      inseriuOrigem = true;
    } else if (s.insumo_id === insumo_id && s.local === destino) {
      saldosAtualizados.push({ ...s, saldo: saldoDestinoAtual + quantidade });
      inseriuDestino = true;
    } else {
      saldosAtualizados.push(s);
    }
  }
  if (!inseriuOrigem) {
    saldosAtualizados.push({ local: origem, insumo_id, saldo: saldoOrigemAtual - quantidade });
  }
  if (!inseriuDestino) {
    saldosAtualizados.push({ local: destino, insumo_id, saldo: saldoDestinoAtual + quantidade });
  }

  const correl = `transferencia:${ref ?? randomRef()}`;
  const movimentacoes: [MovimentacaoPlano, MovimentacaoPlano] = [
    { local: origem, insumo_id, tipo: "saida", quantidade, origem: correl },
    { local: destino, insumo_id, tipo: "entrada", quantidade, origem: correl },
  ];

  return { saldosAtualizados, movimentacoes };
}
