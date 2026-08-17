// Conciliação de Cadastro — RHiD × ERP.
//
// Todo mês reaparecia o mesmo "não cadastrado" na prévia da sincronização, sem
// lugar para resolver. Aqui a divergência tem ação: vincular à pessoa certa,
// marcar como fora do ERP, ou corrigir o de-para de departamento → obra que
// hoje é só heurística sobre o nome do departamento.
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Kpi } from "@/components/common/Kpi";
import RecursoPendente from "@/components/dp/RecursoPendente";
import { toast } from "sonner";
import { AlertCircle, Loader, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth/useAuth";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { usePontoFiltros } from "@/hooks/dp/usePontoFiltros";
import { usePontoRegistros } from "@/hooks/dp/usePonto";
import { useRhidPessoas } from "@/hooks/dp/useRhidPessoas";
import {
  useDepartamentoObra,
  useRhidVinculos,
  useSalvarDepartamentoObra,
  useSalvarRhidVinculo,
} from "@/hooks/dp/usePontoCadastro";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import { extrairCodigoNumerico, isCentroIndireto } from "@/lib/dp/codigos";
import type { RhidPessoa } from "@/lib/rhid/mapApuracao";

const soDigitos = (v: string | null | undefined) => (v ? String(v).replace(/\D/g, "") : "");

interface LinhaDivergencia {
  pessoa: RhidPessoa;
  colaboradorId: string | null;
  colaboradorNome: string | null;
  vinculoManual: boolean;
  ignorado: boolean;
  problemas: string[];
}

export default function PontoConciliacaoCadastro() {
  const { currentPlayer } = useAuth();
  const { colaboradores, obras } = useCatalogos();
  const { inicio, fim } = usePontoFiltros();
  const [buscar, setBuscar] = useState(false);

  const pessoasQuery = useRhidPessoas(buscar);
  const vinculos = useRhidVinculos();
  const dePara = useDepartamentoObra();
  const salvarVinculo = useSalvarRhidVinculo();
  const salvarDePara = useSalvarDepartamentoObra();
  const registros = usePontoRegistros({ inicio, fim });

  const colabPorCpf = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; ativo: boolean }>();
    for (const c of colaboradores) {
      const cpf = soDigitos(c.cpf);
      if (cpf) m.set(cpf, { id: c.id, nome: c.nome, ativo: c.ativo });
    }
    return m;
  }, [colaboradores]);

  const colabPorId = useMemo(() => new Map(colaboradores.map((c) => [c.id, c])), [colaboradores]);

  const vinculoPorPerson = useMemo(
    () => new Map((vinculos.data ?? []).map((v) => [v.id_person, v])),
    [vinculos.data],
  );

  /** Pessoas da RHiD com o diagnóstico de cada divergência. */
  const linhas = useMemo<LinhaDivergencia[]>(() => {
    const pessoas = pessoasQuery.data ?? [];
    return pessoas.map((p) => {
      const vinculo = vinculoPorPerson.get(p.idPerson);
      const porCpf = colabPorCpf.get(soDigitos(p.cpf));
      const colaboradorId = vinculo?.colaborador_id ?? porCpf?.id ?? null;
      const colaborador = colaboradorId ? colabPorId.get(colaboradorId) : undefined;

      const problemas: string[] = [];
      if (!colaboradorId) problemas.push("Sem colaborador no ERP");
      if (colaborador && !colaborador.ativo) problemas.push("Demitido no ERP, ativo na RHiD");
      if (p.numberOfTemplates === 0) problemas.push("Sem biometria");
      if (p.linkedDeviceIds && p.linkedDeviceIds.length === 0) problemas.push("Sem REP vinculado");
      if (!p.cpf) problemas.push("Sem CPF na RHiD");

      return {
        pessoa: p,
        colaboradorId,
        colaboradorNome: colaborador?.nome ?? porCpf?.nome ?? null,
        vinculoManual: Boolean(vinculo?.colaborador_id),
        ignorado: Boolean(vinculo?.ignorado),
        problemas,
      };
    });
  }, [pessoasQuery.data, vinculoPorPerson, colabPorCpf, colabPorId]);

  const pendencias = useMemo(
    () => linhas.filter((l) => !l.ignorado && l.problemas.length > 0),
    [linhas],
  );

  /** Departamentos vistos no período, com a resolução atual de obra. */
  const departamentos = useMemo(() => {
    const vistos = new Map<string, { registros: number; obraId: string | null }>();
    for (const r of registros.data ?? []) {
      const dep = r.departamento_csv;
      if (!dep) continue;
      const atual = vistos.get(dep) ?? { registros: 0, obraId: r.obra_id };
      atual.registros += 1;
      if (r.obra_id) atual.obraId = r.obra_id;
      vistos.set(dep, atual);
    }
    const override = new Map((dePara.data ?? []).map((d) => [d.departamento, d]));
    return Array.from(vistos.entries())
      .map(([departamento, info]) => {
        const manual = override.get(departamento);
        return {
          departamento,
          registros: info.registros,
          obraId: manual?.obra_id ?? info.obraId,
          indireto: manual?.indireto ?? isCentroIndireto(departamento),
          manual: Boolean(manual),
          codigo: extrairCodigoNumerico(departamento),
        };
      })
      .sort((a, b) => b.registros - a.registros);
  }, [registros.data, dePara.data]);

  const vincular = (linha: LinhaDivergencia, colaboradorId: string | null) => {
    salvarVinculo.mutate(
      {
        id_person: linha.pessoa.idPerson,
        colaborador_id: colaboradorId,
        cpf: linha.pessoa.cpf,
        nome_rhid: linha.pessoa.name,
        ignorado: false,
        vinculado_por: currentPlayer?.login ?? null,
      },
      {
        onSuccess: () => toast.success("Vínculo salvo."),
        onError: (e: unknown) =>
          toast.error("Falha ao salvar: " + (e instanceof Error ? e.message : String(e))),
      },
    );
  };

  const ignorar = (linha: LinhaDivergencia, ignorado: boolean) => {
    salvarVinculo.mutate(
      {
        id_person: linha.pessoa.idPerson,
        colaborador_id: linha.colaboradorId,
        cpf: linha.pessoa.cpf,
        nome_rhid: linha.pessoa.name,
        ignorado,
        vinculado_por: currentPlayer?.login ?? null,
      },
      {
        onSuccess: () =>
          toast.success(ignorado ? "Pessoa marcada como fora do ERP." : "Marcação removida."),
        onError: (e: unknown) =>
          toast.error("Falha ao salvar: " + (e instanceof Error ? e.message : String(e))),
      },
    );
  };

  const erroDeRecurso = isRecursoIndisponivel(vinculos.error)
    ? vinculos.error
    : isRecursoIndisponivel(dePara.error)
      ? dePara.error
      : null;

  return (
    <div className="space-y-4">
      {erroDeRecurso && (
        <RecursoPendente
          erro={erroDeRecurso}
          migracao="2026_08_03_ponto_ondas.sql"
          descricao="A leitura abaixo já funciona; gravar o vínculo e o de-para depende das tabelas novas."
        />
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Pessoas da RHiD × colaboradores do ERP</h3>
            <p className="text-xs text-muted-foreground">
              Consulta o cadastro da RHiD sob demanda — cada busca faz login e lê /person.
            </p>
          </div>
          <Button
            onClick={() => (buscar ? pessoasQuery.refetch() : setBuscar(true))}
            disabled={pessoasQuery.isFetching}
          >
            {pessoasQuery.isFetching ? (
              <Loader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {buscar ? "Atualizar cadastro" : "Buscar cadastro da RHiD"}
          </Button>
        </div>

        {pessoasQuery.isError && (
          <div className="mt-3 p-3 bg-destructive/10 rounded-md flex gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{(pessoasQuery.error as Error)?.message}</p>
          </div>
        )}

        {linhas.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Kpi label="Pessoas na RHiD" value={linhas.length} size="lg" />
              <Kpi
                label="Vinculadas ao ERP"
                value={linhas.filter((l) => l.colaboradorId).length}
                tone="success"
                size="lg"
              />
              <Kpi label="Com pendência" value={pendencias.length} tone="warning" size="lg" />
              <Kpi
                label="Marcadas fora do ERP"
                value={linhas.filter((l) => l.ignorado).length}
                tone="muted"
                size="lg"
              />
            </div>

            <div className="overflow-x-auto mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome na RHiD</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Colaborador do ERP</TableHead>
                    <TableHead>Pendências</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pendencias.length > 0 ? pendencias : linhas).slice(0, 200).map((l) => (
                    <TableRow key={l.pessoa.idPerson} className={l.ignorado ? "opacity-50" : ""}>
                      <TableCell className="font-medium text-xs">{l.pessoa.name}</TableCell>
                      <TableCell className="text-xs tabular-nums">{l.pessoa.cpf ?? "—"}</TableCell>
                      <TableCell className="text-xs">{l.pessoa.departamento ?? "—"}</TableCell>
                      <TableCell>
                        <select
                          value={l.colaboradorId ?? ""}
                          onChange={(e) => vincular(l, e.target.value || null)}
                          disabled={salvarVinculo.isPending || !!erroDeRecurso}
                          className="h-9 rounded-md border px-2 bg-background text-xs min-w-[180px]"
                        >
                          <option value="">Sem vínculo</option>
                          {[...colaboradores]
                            .sort((a, b) => a.nome.localeCompare(b.nome))
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                        </select>
                        {l.vinculoManual && (
                          <span className="text-[10px] text-muted-foreground ml-1">manual</span>
                        )}
                      </TableCell>
                      <TableCell className="space-x-1">
                        {l.problemas.map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px]">
                            {p}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={salvarVinculo.isPending || !!erroDeRecurso}
                          onClick={() => ignorar(l, !l.ignorado)}
                        >
                          {l.ignorado ? "Reativar" : "Fora do ERP"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {pendencias.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Mostrando as {pendencias.length} pessoas com pendência. Sem pendências, a lista
                exibe o cadastro completo.
              </p>
            )}
            {linhas.some((l) => l.pessoa.numberOfTemplates === undefined) && (
              <p className="text-xs text-muted-foreground mt-1">
                Biometria e REPs vinculados aparecem depois de publicar a edge function
                <code className="mx-1">rhid-apuracao</code> desta versão.
              </p>
            )}
          </>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold">Departamentos × obras</h3>
        <p className="text-xs text-muted-foreground mb-3">
          A resolução automática casa o último grupo de 3-4 dígitos do nome do departamento com o
          código da obra. Ajuste manual aqui vale sobre a heurística nas próximas importações.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departamento</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Indireto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departamentos.map((d) => (
                <TableRow key={d.departamento}>
                  <TableCell className="text-xs font-medium">{d.departamento}</TableCell>
                  <TableCell className="text-xs font-mono">{d.codigo ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{d.registros}</TableCell>
                  <TableCell>
                    <select
                      value={d.obraId ?? ""}
                      onChange={(e) =>
                        salvarDePara.mutate(
                          {
                            departamento: d.departamento,
                            obra_id: e.target.value || null,
                            indireto: d.indireto,
                            atualizado_por: currentPlayer?.login ?? null,
                          },
                          {
                            onSuccess: () => toast.success("De-para atualizado."),
                            onError: (err: unknown) =>
                              toast.error(
                                "Falha ao salvar: " +
                                  (err instanceof Error ? err.message : String(err)),
                              ),
                          },
                        )
                      }
                      disabled={salvarDePara.isPending || !!erroDeRecurso}
                      className="h-9 rounded-md border px-2 bg-background text-xs min-w-[180px]"
                    >
                      <option value="">Sem obra</option>
                      {obras.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nome}
                        </option>
                      ))}
                    </select>
                    {d.manual && (
                      <span className="text-[10px] text-muted-foreground ml-1">manual</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{d.indireto ? "Sim" : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {departamentos.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum departamento nos registros do período.
          </p>
        )}
      </Card>
    </div>
  );
}
