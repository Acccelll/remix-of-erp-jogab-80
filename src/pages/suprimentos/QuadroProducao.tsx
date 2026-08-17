import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuadroKanban } from "@/components/cards/QuadroKanban";

const SUBS = [
  { key: "todos", label: "Todos", value: undefined as string | undefined },
  { key: "solda", label: "Solda", value: "Solda" },
  { key: "corte", label: "Corte", value: "Corte" },
  { key: "dobra", label: "Dobra", value: "Dobra" },
];

export default function SuprimentosProducao() {
  const [sp, setSp] = useSearchParams();
  const subKey = sp.get("sub") ?? "todos";
  const cur = SUBS.find((s) => s.key === subKey) ?? SUBS[0];

  function setSub(k: string) {
    const next = new URLSearchParams(sp);
    if (k === "todos") next.delete("sub");
    else next.set("sub", k);
    setSp(next, { replace: true });
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Quadro de Produção</h1>
        <p className="text-sm text-muted-foreground">
          Cards manufaturados no trilho de Produção — filtre por subsetor (Solda / Corte / Dobra).
        </p>
      </div>

      <Tabs value={cur.key} onValueChange={setSub}>
        <TabsList>
          {SUBS.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <QuadroKanban setor="Producao" subsetor={cur.value} />
    </div>
  );
}
