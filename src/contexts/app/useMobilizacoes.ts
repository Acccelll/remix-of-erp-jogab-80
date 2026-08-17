import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

import { isSpecialStatus } from "@/lib/cards/status-especiais";
import { reportError } from "@/lib/core/errors";
import {
  Colaborador,
  Contrato,
  DecisoesVeiculos,
  HistoricoEntry,
  Obra,
  Patrimonio,
  Player,
  ResponsabilidadePeriodo,
  Veiculo,
} from "@/types";

interface Options {
  dataLoaded: boolean;
  getObras: () => Obra[];
  getCurrentPlayer: () => Player | null;
  getColumnName: (id: string | null) => string;
  getColaboradores: () => Colaborador[];
  getPatrimonios: () => Patrimonio[];
  getVeiculos: () => Veiculo[];
  getContratos: () => Contrato[];
  getResponsabilidades: () => ResponsabilidadePeriodo[];
  /** Reatribuição de motorista/obra do veículo (mesma operação da tela de Veículos). */
  updateVeiculo: (id: string, d: Partial<Veiculo>) => void;
  setColaboradores: React.Dispatch<React.SetStateAction<Colaborador[]>>;
  setPatrimonios: React.Dispatch<React.SetStateAction<Patrimonio[]>>;
  setVeiculos: React.Dispatch<React.SetStateAction<Veiculo[]>>;
  setContratos: React.Dispatch<React.SetStateAction<Contrato[]>>;
  setResponsabilidadesPatrimonios: React.Dispatch<
    React.SetStateAction<ResponsabilidadePeriodo[]>
  >;
}

export function useMobilizacoes({
  dataLoaded,
  getObras,
  getCurrentPlayer,
  getColumnName,
  getColaboradores,
  getPatrimonios,
  getVeiculos,
  getContratos,
  getResponsabilidades,
  updateVeiculo,
  setColaboradores,
  setPatrimonios,
  setVeiculos,
  setContratos,
  setResponsabilidadesPatrimonios,
}: Options) {
  // ARC-002.slice-39 · responsabilidadesPatrimonios (estado + operações puras)
  // domiciliados em ResponsabilidadesStateProvider; aqui apenas setter/getter injetados.





  // Forward-ref to mobilizarVeiculo so earlier callbacks (mobilizarColaborador, auto-effect) can call it without TDZ.
  const mobilizarVeiculoRef = useRef<
    | ((
        vId: string,
        obraDestinoId: string | null,
        dia: number,
        mes: number,
        ano: number,
      ) => Promise<void>)
    | null
  >(null);

  // ── Auto-move pending mobilizations ──
  useEffect(() => {
    if (!dataLoaded) return;
    const check = () => {
      const now = new Date();
      const obras = getObras();
      const currentPlayer = getCurrentPlayer();
      const veiculos = getVeiculos();

      // Mobilizações agendadas de COLABORADOR são aplicadas pelo servidor
      // (rota `aplicarInativacoesProgramadas`, disparada por
      // `useAplicarInativacoesServidor` a cada carga do app e pelo cron do
      // host). Antes eram aplicadas aqui, com um PUT que mandava o colaborador
      // para a obra: quando ele estava de férias, o backend revertia a mudança
      // e devolvia 200, então a tela mostrava a obra e o banco mantinha férias
      // até o próximo reload. Patrimônio e veículo seguem com o gatilho local,
      // que não passa pela sanitização de status.

      setPatrimonios((prev) =>
        prev.map((p) => {
          if (!p.mobilizacaoPendente || typeof p.mobilizacaoPendente.dataMobilizacao !== "string")
            return p;
          const parts = p.mobilizacaoPendente.dataMobilizacao.split("/");
          const d = parseInt(parts[0]),
            m = parseInt(parts[1]),
            y = parts[2] ? parseInt(parts[2]) : now.getFullYear();
          const targetDate = new Date(y, m - 1, d);
          if (targetDate <= now) {
            const origemNome = obras.find((o) => o.id === p.obraAtualId)?.nome || "Sem Alocação";
            const updated: Patrimonio = {
              ...p,
              obraAtualId: p.mobilizacaoPendente.obraDestinoId || null,
              mobilizacaoPendente: null,
              historico: [
                ...p.historico,
                {
                  id: crypto.randomUUID(),
                  tipo: "mobilizacao" as const,
                  descricao: `Mobilizado de "${origemNome}" para "${p.mobilizacaoPendente.obraDestinoNome}" em ${p.mobilizacaoPendente.dataMobilizacao}`,
                  data: now.toISOString(),
                  usuario: currentPlayer?.login || "Sistema",
                },
              ],
            };
            api
              .update("patrimonios", p.id, updated)
              .catch((err) => reportError("mobilizacoes.error-auto-moving-patrimonio", err));
            return updated;
          }
          return p;
        }),
      );

      setVeiculos((prev) =>
        prev.map((v) => {
          if (!v.mobilizacaoPendente || typeof v.mobilizacaoPendente.dataMobilizacao !== "string")
            return v;
          const parts = v.mobilizacaoPendente.dataMobilizacao.split("/");
          const d = parseInt(parts[0]),
            m = parseInt(parts[1]),
            y = parts[2] ? parseInt(parts[2]) : now.getFullYear();
          const targetDate = new Date(y, m - 1, d);
          if (targetDate <= now) {
            const origemNome = obras.find((o) => o.id === v.obraAtualId)?.nome || "Sem Alocação";
            const updated: Veiculo = {
              ...v,
              obraAtualId: v.mobilizacaoPendente.obraDestinoId || null,
              mobilizacaoPendente: null,
              historico: [
                ...v.historico,
                {
                  id: crypto.randomUUID(),
                  tipo: "mobilizacao" as const,
                  descricao: `Mobilizado de "${origemNome}" para "${v.mobilizacaoPendente.obraDestinoNome}" em ${v.mobilizacaoPendente.dataMobilizacao}`,
                  data: now.toISOString(),
                  usuario: currentPlayer?.login || "Sistema",
                },
              ],
            };
            api
              .update("veiculos", v.id, updated)
              .catch((err) => reportError("mobilizacoes.error-auto-moving-veiculo", err));
            return updated;
          }
          return v;
        }),
      );
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [
    dataLoaded,
    getObras,
    getCurrentPlayer,
    getVeiculos,
    setColaboradores,
    setPatrimonios,
    setVeiculos,
  ]);

  // ── Schedule 7am daily refresh ──
  useEffect(() => {
    const scheduleNext7am = () => {
      const now = new Date();
      const next7 = new Date(now);
      next7.setHours(7, 0, 0, 0);
      if (now >= next7) next7.setDate(next7.getDate() + 1);
      const ms = next7.getTime() - now.getTime();
      return setTimeout(() => {
        setColaboradores((prev) => [...prev]);
        setPatrimonios((prev) => [...prev]);
        setVeiculos((prev) => [...prev]);
        scheduleNext7am();
      }, ms);
    };
    const tid = scheduleNext7am();
    return () => clearTimeout(tid);
  }, [setColaboradores, setPatrimonios, setVeiculos]);

  // ── Colaborador ──
  const mobilizarColaborador = useCallback(
    async (
      colabId: string,
      obraDestinoId: string | null,
      dia: number,
      mes: number,
      ano: number,
      moverVeiculos = false,
      // Decisão por veículo tomada no diálogo de Gestão de Equipe. Quando
      // ausente (mobilização pelo mapa, em `/rh/logistica`), vale o
      // comportamento antigo de `moverVeiculos`: o carro acompanha entre obras.
      decisoesVeiculos?: DecisoesVeiculos,
    ) => {
      const currentPlayer = getCurrentPlayer();
      const colaboradores = getColaboradores();
      const veiculos = getVeiculos();
      const destinoNome = getColumnName(obraDestinoId);
      const now = new Date();
      const targetDate = new Date(ano, mes - 1, dia);
      const isNowOrPast = targetDate <= now;
      const dataProgramada = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

      const isSpecial = obraDestinoId === null || isSpecialStatus(obraDestinoId);
      const novaObraId = isSpecial ? null : obraDestinoId || null;
      const novoStatusEspecial =
        isSpecial && obraDestinoId ? (obraDestinoId as string).replace(/^__|__$/g, "") : null;

      const colabAtual = colaboradores.find((c) => c.id === colabId);
      if (!colabAtual) return;

      let updatedColab: Colaborador;
      if (isNowOrPast) {
        // O evento de histórico é gravado pelo SERVIDOR (rota `mobilizar`).
        // Montá-lo aqui era inútil para persistência — `historico` não é coluna
        // de `colaboradores` e o PUT descartava o campo — e ainda produzia um
        // texto enganoso enquanto a sessão durava, porque a origem e o destino
        // eram resolvidos por um mapa que não reconhecia os ids sem underscore.
        updatedColab = {
          ...colabAtual,
          obraAtualId: novaObraId,
          statusEspecial: novoStatusEspecial,
          mobilizacaoPendente: null,
        };
      } else {
        updatedColab = {
          ...colabAtual,
          mobilizacaoPendente: {
            obraDestinoId: obraDestinoId || "",
            obraDestinoNome: destinoNome,
            dataMobilizacao: `${dia.toString().padStart(2, "0")}/${mes.toString().padStart(2, "0")}/${ano}`,
          },
        };
      }

      // EST-001 · snapshot pré-otimista para rollback em falha.
      const snapshotColab = colabAtual;
      setColaboradores((p) => p.map((c) => (c.id === colabId ? updatedColab : c)));

      try {
        // `mobilizar` é quem grava o evento e, quando a data já venceu, quem
        // aplica o estado. Se falhar, abortar: seguir para o PUT deixaria o
        // colaborador movido sem nenhum registro de como foi parar ali.
        await api.create("mobilizar", {
          colabId,
          obraDestinoId: isSpecial ? null : obraDestinoId,
          dataProgramada,
          usuarioId: currentPlayer?.id || null,
          status: isSpecial ? novoStatusEspecial : null,
        });
      } catch (err) {
        reportError("mobilizacoes.error-registering-mobilization-period", err, { detalhes: [{
          colabId,
          obraDestinoId,
          dataProgramada,
          isSpecial,
        }] });
        setColaboradores((p) => p.map((c) => (c.id === colabId ? snapshotColab : c)));
        toast.error("Falha ao registrar a mobilização. Alteração revertida.");
        return;
      }

      try {
        await api.update("colaboradores", colabId, {
          obraAtualId: updatedColab.obraAtualId,
          obra_atual_id: updatedColab.obraAtualId,
          // Enviados explicitamente (inclusive `null`) para que o backend não
          // reinjete o status anterior por cima.
          statusEspecial: updatedColab.statusEspecial ?? null,
          status_especial: updatedColab.statusEspecial ?? null,
          mobilizacaoPendente: updatedColab.mobilizacaoPendente,
          mobilizacao_pendente: updatedColab.mobilizacaoPendente,
        });

        // Destino especial (folga/férias/afastamento) também mexe no veículo: é
        // justamente quando o carro costuma ficar na obra com outra pessoa.
        const veiculosDoMotorista = veiculos.filter((v) => v.motoristaId === colabId);
        for (const v of veiculosDoMotorista) {
          const decisao =
            decisoesVeiculos?.[v.id] ??
            (moverVeiculos && !isSpecial ? ({ acao: "acompanha" } as const) : null);
          if (!decisao) continue;
          if (decisao.acao === "acompanha") {
            // Em destino especial o colaborador leva o carro para fora da obra,
            // o que no quadro de veículos é "Sem Alocação".
            await mobilizarVeiculoRef.current?.(
              v.id,
              isSpecial ? null : obraDestinoId,
              dia,
              mes,
              ano,
            );
          } else if (decisao.acao === "novoMotorista") {
            updateVeiculo(v.id, { motoristaId: decisao.motoristaId });
          } else {
            // Fica na obra de onde o colaborador saiu — `colabAtual` é o
            // snapshot anterior à atualização otimista acima.
            updateVeiculo(v.id, { motoristaId: null, obraAtualId: colabAtual.obraAtualId });
          }
        }
      } catch (err) {
        reportError("mobilizacoes.error-persisting-colaborador-state", err);
        // EST-001 · rollback do estado otimista.
        setColaboradores((p) => p.map((c) => (c.id === colabId ? snapshotColab : c)));
        toast.error("Erro ao persistir mobilização. Alteração revertida.");
      }
    },
    [
      getCurrentPlayer,
      getColaboradores,
      getVeiculos,
      getColumnName,
      setColaboradores,
      updateVeiculo,
    ],
  );

  const cancelarMobilizacaoColaborador = useCallback(
    async (colabId: string) => {
      const currentPlayer = getCurrentPlayer();
      const colaboradores = getColaboradores();
      const colab = colaboradores.find((c) => c.id === colabId);
      if (!colab?.mobilizacaoPendente) return;
      const pendente = colab.mobilizacaoPendente;
      const updated: Partial<Colaborador> = { mobilizacaoPendente: null };
      const snapshotColabCancel = colab;
      setColaboradores((p) => p.map((c) => (c.id === colabId ? { ...c, ...updated } : c)));
      try {
        // Rota dedicada: limpa a pendência e grava o evento com autoria. Antes
        // isto ia como entrada de `historico` no PUT, que o backend descarta —
        // o cancelamento sumia no primeiro reload.
        await api.create("mobilizar", {
          colabId,
          acao: "cancelar",
          observacao: `Mobilização para "${pendente.obraDestinoNome}" em ${pendente.dataMobilizacao} foi cancelada`,
          usuarioId: currentPlayer?.id || null,
        });
      } catch (err) {
        reportError("mobilizacoes.error-cancelling-mobilization", err);
        // EST-001 · rollback.
        setColaboradores((p) => p.map((c) => (c.id === colabId ? snapshotColabCancel : c)));
        toast.error("Erro ao cancelar mobilização. Alteração revertida.");
      }
    },
    [getCurrentPlayer, getColaboradores, setColaboradores],
  );

  // ── Patrimônio ──
  const mobilizarPatrimonio = useCallback(
    async (patId: string, obraDestinoId: string | null, dia: number, mes: number, ano: number) => {
      const currentPlayer = getCurrentPlayer();
      const patrimonios = getPatrimonios();
      const destinoNome = getColumnName(obraDestinoId);
      const now = new Date();
      const targetDate = new Date(ano, mes - 1, dia);
      const isNowOrPast = targetDate <= now;
      const dataProgramada = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const dataBR = `${dia.toString().padStart(2, "0")}/${mes.toString().padStart(2, "0")}/${ano}`;

      const patAtual = patrimonios.find((pat) => pat.id === patId);
      if (!patAtual) return;
      const origemNome = getColumnName(patAtual.obraAtualId);

      const SPECIAL_PAT: Record<string, "emManutencao" | "sujo"> = {
        __manutencao__: "emManutencao",
        __sujo__: "sujo",
      };
      const isSpecial = obraDestinoId !== null && obraDestinoId in SPECIAL_PAT;
      const isResp = obraDestinoId !== null && obraDestinoId.startsWith("__resp__");
      const flagAtivada = isSpecial ? SPECIAL_PAT[obraDestinoId as string] : null;
      const obraEfetivaLocal = isSpecial ? null : obraDestinoId || null;
      const obraEfetivaBackend = isSpecial || isResp ? null : obraDestinoId || null;

      let updatedPat: Patrimonio;
      if (isNowOrPast) {
        const entry: HistoricoEntry =
          isSpecial || isResp
            ? {
                id: crypto.randomUUID(),
                tipo: "outro",
                descricao: isResp
                  ? `Sob responsabilidade de "${destinoNome}" em ${dataBR}`
                  : `Status alterado para "${destinoNome}" em ${dataBR}`,
                data: now.toISOString(),
                usuario: currentPlayer?.login || "Sistema",
              }
            : {
                id: crypto.randomUUID(),
                tipo: "mobilizacao",
                descricao: `Mobilizado de "${origemNome}" para "${destinoNome}" em ${dataBR}`,
                data: now.toISOString(),
                usuario: currentPlayer?.login || "Sistema",
              };
        updatedPat = {
          ...patAtual,
          obraAtualId: isResp ? obraDestinoId : obraEfetivaLocal,
          mobilizacaoPendente: null,
          historico: [...patAtual.historico, entry],
          ...(flagAtivada === "emManutencao" ? { emManutencao: true } : {}),
          ...(flagAtivada === "sujo" ? { sujo: true } : {}),
        };
      } else {
        updatedPat = {
          ...patAtual,
          mobilizacaoPendente: {
            obraDestinoId: obraDestinoId || "",
            obraDestinoNome: destinoNome,
            dataMobilizacao: dataBR,
          },
        };
      }

      // EST-001 · snapshot pré-otimista.
      const snapshotPat = patAtual;
      setPatrimonios((p) => p.map((pat) => (pat.id === patId ? updatedPat : pat)));

      if (isNowOrPast && isResp) {
        const colabId = (obraDestinoId as string).replace("__resp__", "");
        try {
          // POST encerra o período anterior e cria o novo em transação no PHP
          const inserted = await api.create("responsabilidades", {
            patrimonio_id: patId,
            colaborador_id: colabId,
            data_inicio: dataProgramada,
          });
          if (inserted?.id) {
            setResponsabilidadesPatrimonios((prev) => [
              ...prev.filter((r) => !(r.patrimonioId === patId && r.dataFim === null)),
              {
                id: String(inserted.id),
                patrimonioId: patId,
                colaboradorId: colabId,
                dataInicio: dataProgramada,
                dataFim: null,
              },
            ]);
          }
          updatedPat.responsavelId = colabId;
          setPatrimonios((p) =>
            p.map((pat) => (pat.id === patId ? { ...pat, responsavelId: colabId } : pat)),
          );
        } catch (e) {
          reportError("mobilizacoes.falha-ao-registrar-responsabilidade", e);
          toast.error("Erro ao registrar responsabilidade.");
        }
      } else if (isNowOrPast && !isSpecial && !isResp) {
        try {
          const abertas = getResponsabilidades().filter(
            (r) => r.patrimonioId === patId && r.dataFim === null,
          );
          await Promise.all(
            abertas.map((r) =>
              api.update("responsabilidades", r.id, { data_fim: dataProgramada }).catch(() => null),
            ),
          );
          setResponsabilidadesPatrimonios((prev) =>
            prev.map((r) =>
              r.patrimonioId === patId && r.dataFim === null
                ? { ...r, dataFim: dataProgramada }
                : r,
            ),
          );
          updatedPat.responsavelId = null;
        } catch (e) {
          reportError("mobilizacoes.falha-ao-encerrar-responsabilidade-anter", e);
        }
      }

      try {
        if (!isSpecial && !isResp) {
          await api.create("mobilizarPatrimonio", {
            patId,
            obraDestinoId,
            dataProgramada,
            usuarioId: currentPlayer?.id || null,
          });
        }
        await api.update("patrimonios", patId, {
          obraAtualId: obraEfetivaBackend,
          obra_atual_id: obraEfetivaBackend,
          historico: updatedPat.historico,
          mobilizacaoPendente: updatedPat.mobilizacaoPendente,
          mobilizacao_pendente: updatedPat.mobilizacaoPendente,
          responsavelId: updatedPat.responsavelId ?? null,
          responsavel_id: updatedPat.responsavelId ?? null,
          ...(flagAtivada === "emManutencao" ? { emManutencao: true, em_manutencao: true } : {}),
          ...(flagAtivada === "sujo" ? { sujo: true } : {}),
        });
      } catch (err) {
        reportError("mobilizacoes.error-mobilizing-patrimonio", err);
        // EST-001 · rollback do estado otimista.
        setPatrimonios((p) => p.map((pat) => (pat.id === patId ? snapshotPat : pat)));
        toast.error("Erro ao persistir mobilização do patrimônio. Alteração revertida.");
      }
    },
    [getCurrentPlayer, getPatrimonios, getColumnName, setPatrimonios],
  );

  const cancelarMobilizacaoPatrimonio = useCallback(
    async (patId: string) => {
      const currentPlayer = getCurrentPlayer();
      const patrimonios = getPatrimonios();
      const pat = patrimonios.find((p) => p.id === patId);
      if (!pat?.mobilizacaoPendente) return;
      const pendente = pat.mobilizacaoPendente;
      const updated: Partial<Patrimonio> = {
        mobilizacaoPendente: null,
        historico: [
          ...pat.historico,
          {
            id: crypto.randomUUID(),
            tipo: "outro" as const,
            descricao: `Mobilização para "${pendente.obraDestinoNome}" em ${pendente.dataMobilizacao} foi cancelada`,
            data: new Date().toISOString(),
            usuario: currentPlayer?.login || "Sistema",
          },
        ],
      };
      const snapshotPatCancel = pat;
      setPatrimonios((p) => p.map((x) => (x.id === patId ? { ...x, ...updated } : x)));
      try {
        await api.update("patrimonios", patId, {
          ...updated,
          mobilizacao_pendente: null,
        });
      } catch (err) {
        reportError("mobilizacoes.erro-ao-cancelar-mobiliza-o-patrim-nio", err);
        // EST-001 · rollback.
        setPatrimonios((p) => p.map((x) => (x.id === patId ? snapshotPatCancel : x)));
        toast.error("Erro ao cancelar mobilização. Alteração revertida.");
      }
    },
    [getCurrentPlayer, getPatrimonios, setPatrimonios],
  );

  // ARC-002.slice-39 · encerrarResponsabilidade / encerrarResponsabilidadesDoColaborador
  // / getResponsabilidadeAtiva migrados para ResponsabilidadesStateProvider.


  // ── Veículo ──
  const mobilizarVeiculo = useCallback(
    async (vId: string, obraDestinoId: string | null, dia: number, mes: number, ano: number) => {
      const currentPlayer = getCurrentPlayer();
      const veiculos = getVeiculos();
      const destinoNome = getColumnName(obraDestinoId);
      const now = new Date();
      const targetDate = new Date(ano, mes - 1, dia);
      const isNowOrPast = targetDate <= now;
      const dataProgramada = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

      const vAtual = veiculos.find((v) => v.id === vId);
      if (!vAtual) return;
      const origemNome = getColumnName(vAtual.obraAtualId);

      let updatedV: Veiculo;
      if (isNowOrPast) {
        updatedV = {
          ...vAtual,
          obraAtualId: obraDestinoId || null,
          mobilizacaoPendente: null,
          historico: [
            ...vAtual.historico,
            {
              id: crypto.randomUUID(),
              tipo: "mobilizacao" as const,
              descricao: `Mobilizado de "${origemNome}" para "${destinoNome}" em ${dia.toString().padStart(2, "0")}/${mes.toString().padStart(2, "0")}/${ano}`,
              data: now.toISOString(),
              usuario: currentPlayer?.login || "Sistema",
            },
          ],
        };
      } else {
        updatedV = {
          ...vAtual,
          mobilizacaoPendente: {
            obraDestinoId: obraDestinoId || "",
            obraDestinoNome: destinoNome,
            dataMobilizacao: `${dia.toString().padStart(2, "0")}/${mes.toString().padStart(2, "0")}/${ano}`,
          },
        };
      }

      // EST-001 · snapshot pré-otimista.
      const snapshotV = vAtual;
      setVeiculos((p) => p.map((v) => (v.id === vId ? updatedV : v)));

      try {
        await api.create("mobilizarVeiculo", {
          veiculoId: vId,
          obraDestinoId,
          dataProgramada,
          usuarioId: currentPlayer?.id || null,
        });
        await api.update("veiculos", vId, {
          obraAtualId: updatedV.obraAtualId,
          historico: updatedV.historico,
          mobilizacaoPendente: updatedV.mobilizacaoPendente,
        });
      } catch (err) {
        reportError("mobilizacoes.error-mobilizing-veiculo", err);
        // EST-001 · rollback.
        setVeiculos((p) => p.map((v) => (v.id === vId ? snapshotV : v)));
        toast.error("Erro ao persistir mobilização do veículo. Alteração revertida.");
      }
    },
    [getCurrentPlayer, getVeiculos, getColumnName, setVeiculos],
  );

  // Keep ref in sync so earlier callbacks can invoke mobilizarVeiculo without TDZ.
  useEffect(() => {
    mobilizarVeiculoRef.current = mobilizarVeiculo;
  }, [mobilizarVeiculo]);

  // ── Contrato ──
  const mobilizarContrato = useCallback(
    async (cId: string, obraDestinoId: string | null, dia: number, mes: number, ano: number) => {
      const currentPlayer = getCurrentPlayer();
      const contratos = getContratos();
      const destinoNome = getColumnName(obraDestinoId);
      const now = new Date();
      const targetDate = new Date(ano, mes - 1, dia);
      const isNowOrPast = targetDate <= now;

      const cAtual = contratos.find((c) => c.id === cId);
      if (!cAtual) return;
      const origemNome = getColumnName(cAtual.obraAtualId);

      let updated: Contrato;
      if (isNowOrPast) {
        updated = {
          ...cAtual,
          obraAtualId: obraDestinoId || null,
          ocioso: obraDestinoId === "__ocioso__" ? true : false,
          mobilizacaoPendente: null,
          historico: [
            ...cAtual.historico,
            {
              id: crypto.randomUUID(),
              tipo: "mobilizacao" as const,
              descricao: `Mobilizado de "${origemNome}" para "${destinoNome}" em ${dia.toString().padStart(2, "0")}/${mes.toString().padStart(2, "0")}/${ano}`,
              data: now.toISOString(),
              usuario: currentPlayer?.login || "Sistema",
            },
          ],
        };
        if (obraDestinoId === "__ocioso__") updated.obraAtualId = null;
      } else {
        updated = {
          ...cAtual,
          mobilizacaoPendente: {
            obraDestinoId: obraDestinoId || "",
            obraDestinoNome: destinoNome,
            dataMobilizacao: `${dia.toString().padStart(2, "0")}/${mes.toString().padStart(2, "0")}/${ano}`,
          },
        };
      }

      // EST-001 · snapshot pré-otimista.
      const snapshotC = cAtual;
      setContratos((p) => p.map((c) => (c.id === cId ? updated : c)));

      try {
        await api.update("contratos", cId, {
          obraAtualId: updated.obraAtualId,
          ocioso: updated.ocioso,
          historico: updated.historico,
          mobilizacaoPendente: updated.mobilizacaoPendente,
        });
      } catch (err) {
        reportError("mobilizacoes.error-mobilizing-contrato", err);
        // EST-001 · rollback.
        setContratos((p) => p.map((c) => (c.id === cId ? snapshotC : c)));
        toast.error("Erro ao persistir mobilização do contrato. Alteração revertida.");
      }
    },
    [getCurrentPlayer, getContratos, getColumnName, setContratos],
  );

  return {
    mobilizarColaborador,
    cancelarMobilizacaoColaborador,
    mobilizarPatrimonio,
    cancelarMobilizacaoPatrimonio,
    mobilizarVeiculo,
    mobilizarContrato,
  };
}
