/** @module-kind pure */
/**
 * Barrel do módulo DP (Departamento Pessoal).
 * ARC-007/QC-004: consolida `alocacao`, `codigos`, `holerite-repo`, `parser-holerite-xls`
 * antes soltos em `src/lib/`.
 */
export * from "./alocacao";
export * from "./codigos";
export * from "../repositories/dpHolerite";
export * from "./parser-holerite-xls";
