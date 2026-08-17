/**
 * HubTabs — Container reutilizável para páginas-hub.
 * Cada hub agrupa páginas correlatas em abas com sincronização via `?tab=`,
 * eliminando itens redundantes do menu lateral.
 */
import { ReactNode, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface HubTabDef {
  value: string;
  label: string;
  icon?: LucideIcon;
  element: ReactNode;
}

interface Props {
  tabs: HubTabDef[];
  paramKey?: string;
  /** Conteúdo opcional acima das abas (título do hub, ações globais, etc.). */
  header?: ReactNode;
}

export default function HubTabs({ tabs, paramKey = "tab", header }: Props) {
  const [sp, setSp] = useSearchParams();
  const requested = sp.get(paramKey);
  const current = requested && tabs.some((t) => t.value === requested) ? requested : tabs[0].value;

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === tabs[0].value) next.delete(paramKey);
    else next.set(paramKey, v);
    setSp(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      {header}
      <Tabs value={current} onValueChange={onChange} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto p-1 bg-muted/50">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              {t.icon ? <t.icon className="h-4 w-4" /> : null}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4 focus-visible:outline-none">
            <Suspense
              fallback={
                <div className="space-y-3 animate-pulse">
                  <div className="h-7 w-48 bg-muted rounded" />
                  <div className="h-32 w-full bg-muted/60 rounded" />
                </div>
              }
            >
              {t.element}
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
