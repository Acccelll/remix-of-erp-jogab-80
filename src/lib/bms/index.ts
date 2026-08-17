/** @module-kind pure */
/**
 * Barrel do módulo BMS (Boletim de Medição).
 * ARC-007: consolida arquivos antes soltos em `src/lib/bms-*.ts`.
 *
 * `valorTotalItem` existe em `fechamento` e `valor-item` com assinaturas
 * distintas — reexportamos apenas o de `valor-item` como canônico; para
 * a versão de `fechamento`, importe direto do submódulo.
 */
export * from "./boletim";
export * from "./boletim-storage";
export * from "./excel";
export {
  type BmsRow,
  type CronoItem,
  type ItemMedicaoRow,
  type ContribuicaoItemValor,
  type FuturaNova,
  type RegistroAtraso,
  type PreviaFechamento,
  previstoItemNaJanela,
  calcularPreviaFechamento,
} from "./fechamento";
export * from "./previstas";
export * from "./valor-item";
