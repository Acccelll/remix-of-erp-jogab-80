/** @module-kind pure */
import {
  empresaParametrizacaoRepo,
  formatarNumero,
  type TipoDocumentoNumeravel,
} from "@/lib/empresa/parametrizacao";

export function temNumeracaoCustomizada(
  empresaId: string | null | undefined,
  tipo: TipoDocumentoNumeravel,
): empresaId is string {
  if (!empresaId) return false;
  return !!empresaParametrizacaoRepo.get(empresaId).numeracoes[tipo];
}

export function previewNumeroCustomizado(
  empresaId: string | null | undefined,
  tipo: TipoDocumentoNumeravel,
): string | null {
  if (!temNumeracaoCustomizada(empresaId, tipo)) return null;
  const config = empresaParametrizacaoRepo.get(empresaId).numeracoes[tipo];
  return config ? formatarNumero(config, config.proximo) : null;
}

export function emitirNumeroCustomizado(
  empresaId: string | null | undefined,
  tipo: TipoDocumentoNumeravel,
): { numero: string; emitido: number; rollback: () => void } | null {
  if (!temNumeracaoCustomizada(empresaId, tipo)) return null;
  const anterior = empresaParametrizacaoRepo.get(empresaId);
  const emitido = empresaParametrizacaoRepo.emitirNumero(empresaId, tipo);
  return {
    ...emitido,
    rollback: () => {
      empresaParametrizacaoRepo.save(anterior);
    },
  };
}