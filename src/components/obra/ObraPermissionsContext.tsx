/**
 * ObraPermissionsContext
 *
 * Compartilha o gate de escrita da obra (derivado de `useObraMembership` +
 * RBAC de página) para dentro do subtree de `ObraTabs`. Assim as abas de
 * escrita (Cronograma, Medições, NFs, Recebimentos, etc.) podem consumir
 * `useObraPermissions()` para desabilitar botões sem cada uma refazer a
 * consulta a `obra_membros`. RLS continua sendo a última linha de defesa.
 */
import { createContext, useContext, type ReactNode } from "react";

export interface ObraPermissions {
  canEdit: boolean;
  canManage: boolean;
}

const Ctx = createContext<ObraPermissions>({ canEdit: false, canManage: false });

export function ObraPermissionsProvider({
  value,
  children,
}: {
  value: ObraPermissions;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useObraPermissions(): ObraPermissions {
  return useContext(Ctx);
}
