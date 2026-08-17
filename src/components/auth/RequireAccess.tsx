/**
 * PRO-031 · Fase 3 — Guard de rota por permissão.
 *
 * Uso como layout route: `<Route element={<RequireAccess page="financeiro" />}>`
 * envolvendo as rotas do módulo. GM sempre passa. Negado renderiza um painel
 * inline (nunca `Navigate`, para não criar loop quando a própria rota `/` é
 * negada). RLS/backend continuam sendo a última linha de defesa — isto é
 * gating de UI.
 */
import { useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { NAV_ITEMS } from "@/config/navigation";
import { rotaDaMatrizPara } from "@/lib/authz/paginas";
import type { PageKey } from "@/types";

interface Props {
  /** PageKey exigida (nível mínimo: visualizar). */
  page?: PageKey;
  /** Restringe a GM (ex.: rotas /gm). */
  gm?: boolean;
  /** Conteúdo; quando omitido, renderiza <Outlet/> (layout route). */
  children?: React.ReactNode;
}

export function RequireAccess({ page, gm, children }: Props) {
  const { isGM, hasAccess, can } = usePermissions();
  const location = useLocation();
  const path = location.pathname;
  // Qual linha da matriz governa esta rota. Resolve também abas de hub e rotas
  // dinâmicas (`/obras/123` → `/obras`), que antes escapavam do gate fino e
  // caíam no acesso grosso do módulo — liberar uma página abria as demais.
  const rotaMatriz = useMemo(() => rotaDaMatrizPara(path), [path]);

  let permitido: boolean;
  if (isGM) {
    permitido = true;
  } else if (gm) {
    permitido = false;
  } else if (!page) {
    permitido = true;
  } else if (rotaMatriz) {
    permitido = can(rotaMatriz, "V");
  } else {
    // Nenhuma linha governa a rota: último recurso, gate por módulo.
    permitido = hasAccess(page, "visualizar");
  }

  if (!permitido) {
    // Sugere a primeira página que o usuário realmente alcança — resolvendo a
    // linha que governa cada item, para não oferecer um destino igualmente negado.
    const destino = NAV_ITEMS.find((n) => {
      if (n.alwaysVisible === true) return true;
      const r = rotaDaMatrizPara(n.to);
      return r ? can(r, "V") : hasAccess(n.permission, "visualizar");
    });
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="max-w-md text-center space-y-3 p-6 bg-card border border-border rounded-lg">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="font-display text-lg font-bold">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para visualizar esta página. Solicite acesso a um
            administrador (GM).
          </p>
          {destino && (
            <Button asChild variant="outline" size="sm">
              <Link to={destino.to}>Ir para {destino.label}</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return children !== undefined ? <>{children}</> : <Outlet />;
}

export default RequireAccess;
