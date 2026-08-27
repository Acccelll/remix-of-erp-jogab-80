/**
 * Portal de Campo (system design §5.9) — shell reduzido pra quem só tem
 * vínculo em `obra_membros` (nenhum PageKey/setor). Mesma SPA, mesma auth,
 * mesma infra offline (`src/lib/offline/`) — só um layout diferente, sem o
 * menu completo do resto do sistema.
 */
import { Outlet } from "react-router-dom";
import { LogOut, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth/useAuth";

export default function CampoLayout() {
  const { currentPlayer, logout } = useAuth();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <HardHat className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="text-sm font-semibold leading-none">Portal de Campo</div>
            {currentPlayer && (
              <div className="text-xs text-muted-foreground">{currentPlayer.login}</div>
            )}
          </div>
        </div>
        <Button size="icon" variant="ghost" title="Sair" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>
      <main className="mx-auto max-w-md p-4">
        <Outlet />
      </main>
    </div>
  );
}
