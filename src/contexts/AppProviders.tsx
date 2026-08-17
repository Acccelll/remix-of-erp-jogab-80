/**
 * Composição canônica dos providers da aplicação.
 *
 * Fonte única da árvore de contextos: quem monta a aplicação (`App.tsx`, um
 * teste, um storybook) usa `<AppProviders>` e recebe TODOS os contextos, na
 * ordem certa. Não existe página que precise montar wrapper por conta própria
 * — se um contexto é global, ele entra em `APP_PROVIDERS` e pronto.
 *
 * Por que a lista em vez de JSX aninhado: a árvore aninhada tinha 24 níveis de
 * indentação, e num refactor recente alguns wrappers foram removidos sem que
 * ninguém percebesse — as páginas que consumiam `useColaboradoresContext`,
 * `useDocumentosContext` & cia. quebraram em produção. Com a lista, remover um
 * provider é uma linha visível no diff e o teste de completude
 * (`__tests__/AppProviders.test.tsx`) reprova a falta.
 *
 * Ordem = de fora para dentro. As camadas:
 *   1. Infra de UI      — tema, tooltip, estado de UI (nada depende de dados)
 *   2. Sessão           — quem é o usuário
 *   3. Estado de domínio— donos reais dos dados (`*StateProvider` e afins)
 *   4. Fachada          — `AppProvider`, que compõe a leitura das camadas 2-3
 *   5. Subcontextos     — recortes de compatibilidade servidos pela fachada
 *   6. Derivados        — dependem da fachada/subcontextos (documentos, empresa…)
 *
 * Regra ao acrescentar um provider: ele vai na camada do que ele CONSOME, nunca
 * acima dela.
 */
import React from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useProviderMounted } from "@/contexts/createRequiredContext";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { UIProvider } from "@/contexts/ui/UIContext";
import { AuthProvider } from "@/contexts/auth/AuthContext";
import { FuncoesProvider } from "@/contexts/FuncoesContext";
import { PlayersProvider } from "@/contexts/PlayersContext";
import { ObrasProvider } from "@/contexts/ObrasContext";
import { ClientesStateProvider } from "@/contexts/clientes/ClientesStateContext";
import { OportunidadesStateProvider } from "@/contexts/clientes/OportunidadesStateContext";
import { ColaboradoresStateProvider } from "@/contexts/colaboradores/ColaboradoresStateContext";
import { PatrimoniosStateProvider } from "@/contexts/patrimonios/PatrimoniosStateContext";
import { VeiculosStateProvider } from "@/contexts/veiculos/VeiculosStateContext";
import { ContratosStateProvider } from "@/contexts/contratos/ContratosStateContext";
import { ResponsabilidadesStateProvider } from "@/contexts/responsabilidades/ResponsabilidadesStateContext";
import { MobilizacoesProvider } from "@/contexts/mobilizacoes/MobilizacoesContext";
import { AppProvider } from "@/contexts/AppContext";
import { ColaboradoresProvider } from "@/contexts/ColaboradoresContext";
import { PatrimoniosProvider } from "@/contexts/PatrimoniosContext";
import { VeiculosProvider } from "@/contexts/VeiculosContext";
import { ContratosProvider } from "@/contexts/ContratosContext";
import { ClientesProvider } from "@/contexts/ClientesContext";
import { AuthMethodsProvider } from "@/contexts/auth/AuthMethodsContext";
import { DocumentosProvider } from "@/contexts/DocumentosContext";
import { MobilizacoesPendentesProvider } from "@/contexts/MobilizacoesPendentesContext";
import { EmpresaProvider } from "@/contexts/EmpresaContext";

type ProviderComponent = React.ComponentType<{ children: React.ReactNode }>;

export interface CamadaProvider {
  /** Nome exportado do provider — é o que aparece no diagnóstico de ausência. */
  nome: string;
  Component: ProviderComponent;
}

/** Da camada mais externa para a mais interna. A ordem é contrato. */
export const APP_PROVIDERS: readonly CamadaProvider[] = [
  // 1. Infra de UI
  { nome: "ThemeProvider", Component: ThemeProvider },
  { nome: "TooltipProvider", Component: TooltipProvider },
  { nome: "UIProvider", Component: UIProvider },
  // 2. Sessão
  { nome: "AuthProvider", Component: AuthProvider },
  // 3. Estado de domínio
  { nome: "FuncoesProvider", Component: FuncoesProvider },
  { nome: "PlayersProvider", Component: PlayersProvider },
  { nome: "ObrasProvider", Component: ObrasProvider },
  { nome: "ClientesStateProvider", Component: ClientesStateProvider },
  { nome: "OportunidadesStateProvider", Component: OportunidadesStateProvider },
  { nome: "ColaboradoresStateProvider", Component: ColaboradoresStateProvider },
  { nome: "PatrimoniosStateProvider", Component: PatrimoniosStateProvider },
  { nome: "VeiculosStateProvider", Component: VeiculosStateProvider },
  { nome: "ContratosStateProvider", Component: ContratosStateProvider },
  { nome: "ResponsabilidadesStateProvider", Component: ResponsabilidadesStateProvider },
  { nome: "MobilizacoesProvider", Component: MobilizacoesProvider },
  // 4. Fachada
  { nome: "AppProvider", Component: AppProvider },
  // 5. Subcontextos servidos pela fachada
  { nome: "ColaboradoresProvider", Component: ColaboradoresProvider },
  { nome: "PatrimoniosProvider", Component: PatrimoniosProvider },
  { nome: "VeiculosProvider", Component: VeiculosProvider },
  { nome: "ContratosProvider", Component: ContratosProvider },
  { nome: "ClientesProvider", Component: ClientesProvider },
  // 6. Derivados
  { nome: "AuthMethodsProvider", Component: AuthMethodsProvider },
  { nome: "DocumentosProvider", Component: DocumentosProvider },
  { nome: "MobilizacoesPendentesProvider", Component: MobilizacoesPendentesProvider },
  { nome: "EmpresaProvider", Component: EmpresaProvider },
];

/**
 * Monta um provider e o anota no registro de "quem está na árvore" — é essa
 * lista que o diagnóstico de provider ausente imprime junto do erro.
 */
const ProviderMontado: React.FC<{
  nome: string;
  Component: ProviderComponent;
  children: React.ReactNode;
}> = ({ nome, Component, children }) => {
  useProviderMounted(nome);
  return <Component>{children}</Component>;
};

/** Aninha as camadas na ordem da lista (primeira = mais externa). */
export function comporProviders(
  camadas: readonly CamadaProvider[],
  children: React.ReactNode,
): React.ReactNode {
  return camadas.reduceRight<React.ReactNode>(
    (acc, { nome, Component }) => (
      <ProviderMontado key={nome} nome={nome} Component={Component}>
        {acc}
      </ProviderMontado>
    ),
    children,
  );
}

/**
 * Envolve `children` com toda a árvore de contextos da aplicação.
 *
 * Não inclui `QueryClientProvider`: ele precisa do `client` e fica acima daqui
 * (em `App.tsx`), para que testes possam injetar um QueryClient próprio.
 */
export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{comporProviders(APP_PROVIDERS, children)}</>
);
