import React, { useState, useCallback, useRef, useMemo } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import {
  Cliente,
  Oportunidade,
  FunilEstagio,
  Colaborador,
  Obra,
  Player,
  DocumentoVencimento,
  Funcao,
  Patrimonio,
  Veiculo,
  DocumentoTipo,
  Contrato,
  ResponsabilidadePeriodo,
  DecisoesVeiculos,
} from "@/types";
import { useAuthState } from "@/contexts/auth/AuthContext";

// ARC-002.slice-31 · Onda 6 — players domiciliados em `PlayersProvider`.
import { usePlayersContext } from "@/contexts/PlayersContext";
// ARC-002.slice-32 · Onda 6 — obras domiciliadas em `ObrasProvider`.
import { useObrasContext } from "@/contexts/ObrasContext";
// ARC-002.slice-33 · Onda 6 — clientes domiciliados em `ClientesStateProvider`.
import { useClientesStateContext } from "@/contexts/clientes/ClientesStateContext";
// ARC-002.slice-34 · Onda 6 — CRM (oportunidades + funil) domiciliados.
import { useOportunidadesStateContext } from "@/contexts/clientes/OportunidadesStateContext";
// ARC-002.slice-35 · Onda 6 — colaboradores domiciliados em `ColaboradoresStateProvider`.
import { useColaboradoresStateContext } from "@/contexts/colaboradores/ColaboradoresStateContext";
// ARC-002.slice-36 · Onda 6 — patrimonios domiciliados em `PatrimoniosStateProvider`.
import { usePatrimoniosStateContext } from "@/contexts/patrimonios/PatrimoniosStateContext";
// ARC-002.slice-37 · Onda 6 — veiculos domiciliados em `VeiculosStateProvider`.
import { useVeiculosStateContext } from "@/contexts/veiculos/VeiculosStateContext";
// ARC-002.slice-38 · Onda 6 — contratos domiciliados em `ContratosStateProvider`.
import {
  type AddContratoOptions,
  useContratosStateContext,
} from "@/contexts/contratos/ContratosStateContext";
// ARC-002.slice-39 · Onda 6 — responsabilidades domiciliadas.
import { useResponsabilidadesStateContext } from "@/contexts/responsabilidades/ResponsabilidadesStateContext";
// ARC-002.slice-40 · Onda 6 — mobilizações domiciliadas em MobilizacoesProvider.
import { useMobilizacoesContext } from "@/contexts/mobilizacoes/MobilizacoesContext";
import { useUpdateColaborador } from "@/contexts/app/useUpdateColaborador";
import { useColumnName } from "@/contexts/app/useColumnName";
import { useStableGetter } from "@/contexts/app/useStableGetter";
// ARC-002.slice-26 · Onda 6 — `useHasAccess` deixou de ser consumido aqui;
// o cálculo foi domiciliado em `usePermissions` (leitura derivada, sem estado).

// ARC-002.slice-30 · Onda 6 — mutações de catálogos (funcoes/documentosTipo)
// domiciliadas em `FuncoesProvider`; aqui apenas bridge de leitura para a fachada.
import { useFuncoesContext } from "@/contexts/FuncoesContext";

// ARC-002.slice-39 · Onda 6 — última query (`useAppQueries`) domiciliada em
// ResponsabilidadesStateProvider; `useSyncQueryToState` não é mais necessário aqui.



export interface AppContextType {
  currentPlayer: Player | null;
  // ARC-002.slice-29 · Onda 6 — `login`/`logout` migrados para `AuthMethodsProvider`; use `useAuth()`.
  clientes: Cliente[];
  addCliente: (c: Omit<Cliente, "id">) => Promise<Cliente | undefined>;
  updateCliente: (id: string, d: Partial<Cliente>) => void;
  deleteCliente: (id: string) => void;
  // CRM
  oportunidades: Oportunidade[];
  funilEstagios: FunilEstagio[];
  addOportunidade: (
    l: Omit<Oportunidade, "id"> & { valorEstimado?: number },
  ) => Promise<Oportunidade | undefined>;
  updateOportunidade: (id: string, d: Partial<Oportunidade>) => void;
  deleteOportunidade: (id: string) => void;
  moverEstagio: (id: string, estagio: string) => void;
  converterOportunidade: (id: string) => Promise<string | undefined>;
  obras: Obra[];
  addObra: (o: Omit<Obra, "id">) => Promise<Obra | undefined>;
  updateObra: (id: string, d: Partial<Obra>) => void;
  deleteObra: (id: string) => void;
  colaboradores: Colaborador[];
  addColaborador: (
    d: Omit<
      Colaborador,
      "id" | "integracoes" | "documentos" | "historico" | "mobilizacaoPendente" | "ferias"
    >,
  ) => void;
  updateColaborador: (id: string, d: Partial<Colaborador>) => void;
  deleteColaborador: (id: string) => void;
  mobilizarColaborador: (
    colabId: string,
    obraDestinoId: string | null,
    dia: number,
    mes: number,
    ano: number,
    moverVeiculos?: boolean,
    decisoesVeiculos?: DecisoesVeiculos,
  ) => Promise<void>;
  cancelarMobilizacaoColaborador: (colabId: string) => Promise<void>;
  patrimonios: Patrimonio[];
  addPatrimonio: (d: Omit<Patrimonio, "id" | "historico" | "mobilizacaoPendente">) => void;
  updatePatrimonio: (id: string, d: Partial<Patrimonio>) => void;
  deletePatrimonio: (id: string) => void;
  mobilizarPatrimonio: (
    patId: string,
    obraDestinoId: string | null,
    dia: number,
    mes: number,
    ano: number,
  ) => Promise<void>;
  cancelarMobilizacaoPatrimonio: (patId: string) => Promise<void>;
  responsabilidadesPatrimonios: ResponsabilidadePeriodo[];
  encerrarResponsabilidade: (responsabilidadeId: string, dataFim?: string) => Promise<void>;
  encerrarResponsabilidadesDoColaborador: (
    colaboradorId: string,
    dataFim?: string,
  ) => Promise<void>;
  getResponsabilidadeAtiva: (patrimonioId: string) => ResponsabilidadePeriodo | null;
  veiculos: Veiculo[];
  addVeiculo: (d: Omit<Veiculo, "id" | "historico" | "mobilizacaoPendente">) => void;
  updateVeiculo: (id: string, d: Partial<Veiculo>) => void;
  deleteVeiculo: (id: string) => void;
  mobilizarVeiculo: (
    vId: string,
    obraDestinoId: string | null,
    dia: number,
    mes: number,
    ano: number,
  ) => Promise<void>;
  contratos: Contrato[];
  addContrato: (
    d: Omit<Contrato, "id" | "historico" | "mobilizacaoPendente" | "aditivos">,
    options?: AddContratoOptions,
  ) => Promise<Contrato | undefined>;
  updateContrato: (id: string, d: Partial<Contrato>) => void;
  deleteContrato: (id: string) => void;
  mobilizarContrato: (
    cId: string,
    obraDestinoId: string | null,
    dia: number,
    mes: number,
    ano: number,
  ) => Promise<void>;
  players: Player[];
  addPlayer: (p: Omit<Player, "id" | "isGM">) => void;
  updatePlayer: (id: string, d: Partial<Player>) => void;
  deletePlayer: (id: string) => void;
  funcoes: Funcao[];
  addFuncao: (f: Omit<Funcao, "id">) => void;
  updateFuncao: (id: string, d: Partial<Funcao>) => void;
  documentosTipo: DocumentoTipo[];
  addDocumentoTipo: (d: Omit<DocumentoTipo, "id">) => void;
  updateDocumentoTipo: (id: string, d: Partial<DocumentoTipo>) => void;
  deleteDocumentoTipo: (id: string) => void;
  // ARC-002.slice-26 · Onda 6 — `hasAccess` removido do contrato; use `usePermissions()`.
  // ARC-002.slice-27 · Onda 6 — `sidebarOpen`/`setSidebarOpen` movidos para `UIProvider`; use `useUI()`.
  dataLoaded: boolean;
}

const AppContext = createRequiredContext<AppContextType>({
  hook: "useApp",
  provider: "AppProvider",
  file: "src/contexts/AppContext.tsx",
});
export const useApp = () => {
  return useRequiredContext(AppContext);
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ARC-002.slice-28 · Onda 6 — `currentPlayer` domiciliado em `AuthProvider`.
  // AppProvider consome via bridge; login/logout ainda vivem aqui pois dependem
  // de `players`/`dataLoaded`.
  const { currentPlayer, setCurrentPlayer } = useAuthState();
  const { obras, addObra, updateObra, deleteObra, obrasLoaded } = useObrasContext();
  const { clientes, addCliente, updateCliente, deleteCliente, clientesLoaded } = useClientesStateContext();
  const {
    oportunidades,
    addOportunidade,
    updateOportunidade,
    deleteOportunidade,
    moverEstagio,
    converterOportunidade,
    funilEstagios,
    crmLoaded,
  } = useOportunidadesStateContext();
  const currentPlayerRef = useRef<Player | null>(currentPlayer);
  currentPlayerRef.current = currentPlayer;
  const funcoesRef = useRef<Funcao[]>([]);
  // Stable getters (refs ensure freshness; useCallback ensures stable identity for downstream effects).
  const getCurrentPlayer = useCallback(() => currentPlayerRef.current, []);
  const getFuncoesStable = useCallback(() => funcoesRef.current, []);
  const { players, addPlayer, updatePlayer, deletePlayer, playersLoaded } = usePlayersContext();
  // ARC-002.slice-39 · queryEnabled removido — não há mais queries locais.
  const {
    funcoes,
    addFuncao,
    updateFuncao,
    documentosTipo,
    addDocumentoTipo,
    updateDocumentoTipo,
    deleteDocumentoTipo,
    catalogosLoaded,
  } = useFuncoesContext();
  const {
    colaboradores,
    setColaboradores,
    addColaborador,
    updateColaborador,
    deleteColaborador,
    colaboradoresLoaded,
    getColaboradores: getColaboradoresStable,
  } = useColaboradoresStateContext();
  const {
    patrimonios,
    setPatrimonios,
    addPatrimonio,
    updatePatrimonio,
    deletePatrimonio,
    patrimoniosLoaded,
    getPatrimonios: getPatrimoniosStable,
  } = usePatrimoniosStateContext();
  const {
    veiculos,
    setVeiculos,
    addVeiculo,
    updateVeiculo,
    deleteVeiculo,
    veiculosLoaded,
    getVeiculos: getVeiculosStable,
  } = useVeiculosStateContext();
  const {
    contratos,
    setContratos,
    addContrato,
    updateContrato,
    deleteContrato,
    contratosLoaded,
    getContratos: getContratosStable,
  } = useContratosStateContext();
  const {
    responsabilidadesPatrimonios,
    encerrarResponsabilidade,
    encerrarResponsabilidadesDoColaborador,
    getResponsabilidadeAtiva,
    responsabilidadesLoaded,
  } = useResponsabilidadesStateContext();

  // ARC-002.slice-40 · mobilizações via MobilizacoesProvider.
  const {
    mobilizarColaborador,
    cancelarMobilizacaoColaborador,
    mobilizarPatrimonio,
    cancelarMobilizacaoPatrimonio,
    mobilizarVeiculo,
    mobilizarContrato,
  } = useMobilizacoesContext();

  const dataLoaded =
    catalogosLoaded && playersLoaded && obrasLoaded &&
    clientesLoaded && crmLoaded && colaboradoresLoaded && patrimoniosLoaded &&
    veiculosLoaded && contratosLoaded && responsabilidadesLoaded;
  funcoesRef.current = funcoes;





  // Obras CRUD → extraído para src/contexts/app/useObrasState.ts

  // ARC-002.slice-35 · updateColaborador agora vem de ColaboradoresStateProvider.


  // deleteColaborador → extraído para src/contexts/app/useColaboradoresState.ts

  // mobilizar* / cancelar* / encerrarResponsabilidade* / getResponsabilidadeAtiva → extraídos para src/contexts/app/useMobilizacoes.ts

  // Players / Funções / DocumentosTipo CRUDs → extraídos para src/contexts/app/use*State.ts

  // ARC-002.slice-26 · Onda 6 — cálculo de `hasAccess` migrado para `usePermissions`.

  // ARC-002/ARC-004 · Onda 6 — value memoizado; AppProvider encerra a limpeza estrutural.
  const value = useMemo<AppContextType>(
    () => ({
      currentPlayer,
      clientes,
      addCliente,
      updateCliente,
      deleteCliente,
      oportunidades,
      funilEstagios,
      addOportunidade,
      updateOportunidade,
      deleteOportunidade,
      moverEstagio,
      converterOportunidade,
      obras,
      addObra,
      updateObra,
      deleteObra,
      colaboradores,
      addColaborador,
      updateColaborador,
      deleteColaborador,
      mobilizarColaborador,
      cancelarMobilizacaoColaborador,
      patrimonios,
      addPatrimonio,
      updatePatrimonio,
      deletePatrimonio,
      mobilizarPatrimonio,
      cancelarMobilizacaoPatrimonio,
      responsabilidadesPatrimonios,
      encerrarResponsabilidade,
      encerrarResponsabilidadesDoColaborador,
      getResponsabilidadeAtiva,
      veiculos,
      addVeiculo,
      updateVeiculo,
      deleteVeiculo,
      mobilizarVeiculo,
      contratos,
      addContrato,
      updateContrato,
      deleteContrato,
      mobilizarContrato,
      players,
      addPlayer,
      updatePlayer,
      deletePlayer,
      funcoes,
      addFuncao,
      updateFuncao,
      documentosTipo,
      addDocumentoTipo,
      updateDocumentoTipo,
      deleteDocumentoTipo,
      dataLoaded,
    }),
    [
      currentPlayer,
      clientes,
      addCliente,
      updateCliente,
      deleteCliente,
      oportunidades,
      funilEstagios,
      addOportunidade,
      updateOportunidade,
      deleteOportunidade,
      moverEstagio,
      converterOportunidade,
      obras,
      addObra,
      updateObra,
      deleteObra,
      colaboradores,
      addColaborador,
      updateColaborador,
      deleteColaborador,
      mobilizarColaborador,
      cancelarMobilizacaoColaborador,
      patrimonios,
      addPatrimonio,
      updatePatrimonio,
      deletePatrimonio,
      mobilizarPatrimonio,
      cancelarMobilizacaoPatrimonio,
      responsabilidadesPatrimonios,
      encerrarResponsabilidade,
      encerrarResponsabilidadesDoColaborador,
      getResponsabilidadeAtiva,
      veiculos,
      addVeiculo,
      updateVeiculo,
      deleteVeiculo,
      mobilizarVeiculo,
      contratos,
      addContrato,
      updateContrato,
      deleteContrato,
      mobilizarContrato,
      players,
      addPlayer,
      updatePlayer,
      deletePlayer,
      funcoes,
      addFuncao,
      updateFuncao,
      documentosTipo,
      addDocumentoTipo,
      updateDocumentoTipo,
      deleteDocumentoTipo,

      dataLoaded,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

