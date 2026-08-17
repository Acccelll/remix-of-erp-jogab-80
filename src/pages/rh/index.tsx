import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DpDashboard } from "@/components/dp/DpDashboard";
import Colaboradores from "./Colaboradores";

export default function RhPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Recursos Humanos & DP</h1>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard DP</TabsTrigger>
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="folha">Folha de Pagamento</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <DpDashboard />
        </TabsContent>

        <TabsContent value="colaboradores">
          <Colaboradores />
        </TabsContent>

        <TabsContent value="folha" className="space-y-4">
          <div className="p-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
            Módulo de importação e conferência de folha (TOTVS) em desenvolvimento.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
