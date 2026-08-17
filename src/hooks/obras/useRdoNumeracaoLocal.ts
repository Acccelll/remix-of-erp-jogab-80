// PRO-005 · slice-01 — Persistência local da numeração + trava de RDO.
// Backend real de RDO permanece intocado; este hook cobre o registro
// paralelo enquanto a integração server-side não é feita.

import { useCallback, useEffect, useState } from "react";
import { emitirNumeroCustomizado } from "@/lib/empresa/numeracao-documentos";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import {
  gerarNumeroRdo,
  numeroDuplicado,
  podeAssinar,
  podeEditar,
  podeFechar,
  validarAssinatura,
  type RdoAssinaturaLocal,
  type RdoRegistroLocal,
} from "@/lib/rdo/numeracao";

function carregar(): RdoRegistroLocal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.rdoNumeracao);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RdoRegistroLocal[]) : [];
  } catch {
    return [];
  }
}

function salvar(regs: RdoRegistroLocal[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.rdoNumeracao, JSON.stringify(regs));
}

export function useRdoNumeracaoLocal() {
  const [registros, setRegistros] = useState<RdoRegistroLocal[]>(() => carregar());

  useEffect(() => {
    salvar(registros);
  }, [registros]);

  const registrar = useCallback(
    (input: {
      id: string;
      obraId: string;
      empresaId?: string | null;
      data?: string | Date;
    }): RdoRegistroLocal | { erro: string } => {
      const existente = registros.find((r) => r.id === input.id);
      if (existente) return existente;
      const d = input.data ? new Date(input.data) : new Date();
      if (Number.isNaN(d.getTime())) return { erro: "Data inválida para gerar número de RDO." };
      const ano = d.getFullYear();
      const numeroParametrizado = emitirNumeroCustomizado(input.empresaId, "rdo");
      const numeroGerado = numeroParametrizado
        ? { numero: numeroParametrizado.numero, sequencial: numeroParametrizado.emitido }
        : gerarNumeroRdo({
          obraId: input.obraId,
          data: input.data,
          registros,
        });
      const sequencial = numeroGerado.sequencial;
      const numero = numeroGerado.numero;
      if (numeroDuplicado(registros, numero)) {
        numeroParametrizado?.rollback();
        return { erro: `Número ${numero} já usado.` };
      }
      const novo: RdoRegistroLocal = {
        id: input.id,
        obraId: input.obraId,
        empresaId: input.empresaId ?? undefined,
        ano,
        sequencial,
        numero,
        fechado: false,
      };
      setRegistros((prev) => [...prev, novo]);
      return novo;
    },
    [registros],
  );

  const fechar = useCallback(
    (id: string, por?: string): { erro?: string } => {
      const alvo = registros.find((r) => r.id === id);
      const v = podeFechar(alvo);
      if (!v.ok) return { erro: v.motivo };
      setRegistros((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, fechado: true, fechadoEm: new Date().toISOString(), fechadoPor: por } : r,
        ),
      );
      return {};
    },
    [registros],
  );

  const assinar = useCallback(
    (id: string, assinatura: RdoAssinaturaLocal): { erro?: string } => {
      const alvo = registros.find((r) => r.id === id);
      const pode = podeAssinar(alvo);
      if (!pode.ok) return { erro: pode.motivo };
      const valida = validarAssinatura(assinatura);
      if (!valida.ok) return { erro: valida.motivo };
      const assinadoEm = assinatura.assinadoEm ?? new Date().toISOString();
      setRegistros((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                assinadoEm,
                assinadoPor: assinatura.assinadoPor.trim(),
                assinaturaDataUrl: assinatura.assinaturaDataUrl,
              }
            : r,
        ),
      );
      return {};
    },
    [registros],
  );

  const assinarEFechar = useCallback(
    (id: string, assinatura: RdoAssinaturaLocal): { erro?: string } => {
      const alvo = registros.find((r) => r.id === id);
      const podeFecharRegistro = podeFechar(alvo);
      if (!podeFecharRegistro.ok) return { erro: podeFecharRegistro.motivo };
      const podeAssinarRegistro = podeAssinar(alvo);
      if (!podeAssinarRegistro.ok) return { erro: podeAssinarRegistro.motivo };
      const valida = validarAssinatura(assinatura);
      if (!valida.ok) return { erro: valida.motivo };
      const assinadoEm = assinatura.assinadoEm ?? new Date().toISOString();
      const assinadoPor = assinatura.assinadoPor.trim();
      setRegistros((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                fechado: true,
                fechadoEm: assinadoEm,
                fechadoPor: assinadoPor,
                assinadoEm,
                assinadoPor,
                assinaturaDataUrl: assinatura.assinaturaDataUrl,
              }
            : r,
        ),
      );
      return {};
    },
    [registros],
  );

  const podeEditarPorId = useCallback(
    (id: string) => podeEditar(registros.find((r) => r.id === id)),
    [registros],
  );

  const obter = useCallback(
    (id: string): RdoRegistroLocal | undefined => registros.find((r) => r.id === id),
    [registros],
  );

  return { registros, registrar, fechar, assinar, assinarEFechar, podeEditar: podeEditarPorId, obter };
}
