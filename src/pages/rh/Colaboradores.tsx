import React, { useState, useRef, useMemo } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { usePatrimoniosContext } from "@/contexts/PatrimoniosContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Download,
  Upload,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Users,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import EmployeeFormDialog from "@/components/rh/EmployeeFormDialog";
import EmployeeProfileDialog from "@/components/rh/EmployeeProfileDialog";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import DatePickerField from "@/components/common/DatePickerField";

import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";
import { Colaborador, FeriasEntry, HistoricoEntry } from "@/types";
import { cn, formatCPF } from "@/lib/utils";
import { validateColaborador } from "@/lib/schemas/colaborador";
import { useAplicarInativacoesProgramadas } from "@/hooks/rh/useAplicarInativacoesProgramadas";
import { rotuloStatus, STATUS_TONE_CLASSES } from "@/lib/rh/statusHistorico";

type SortField = "matricula" | "nome" | "funcao" | "cidade" | "obra";
type SortDir = "asc" | "desc" | null;

const Colaboradores = () => {
  const { colaboradores, updateColaborador, deleteColaborador, addColaborador } =
    useColaboradoresContext();
  const { hasAccess, currentPlayer } = usePermissions();
  const { obras } = useObrasContext();
  const { patrimonios, responsabilidadesPatrimonios, encerrarResponsabilidadesDoColaborador } =
    usePatrimoniosContext();
  const canEdit = hasAccess("rh", "editar");
  const isGM = currentPlayer?.isGM;
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [inativarTarget, setInativarTarget] = useState<Colaborador | null>(null);
  const [isRescisao, setIsRescisao] = useState(false);
  const [dataRescisao, setDataRescisao] = useState("");
  const [dataInativacao, setDataInativacao] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Aplica inativações programadas que já venceram (dataInativacao <= hoje).
  useAplicarInativacoesProgramadas({
    colaboradores,
    updateColaborador,
    encerrarResponsabilidadesDoColaborador,
    usuario: currentPlayer?.login,
  });

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Import duplicates
  const [dupsOpen, setDupsOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [newEntries, setNewEntries] = useState<any[]>([]);

  const getObraNome = (obraId: string | null) => {
    if (!obraId) return "";
    return obras.find((o) => o.id === obraId)?.nome || "";
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortField(null);
        setSortDir(null);
      } else setSortDir("asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let list = colaboradores.filter((c) => {
      if (!showInactive && !c.ativo) return false;
      if (showInactive && c.ativo) return false;
      if (search) {
        const s = search.toLowerCase();
        const digits = search.replace(/\D/g, "");
        const cpfClean = (c.cpf || "").replace(/\D/g, "");
        const matchCpf = digits.length > 0 && cpfClean.includes(digits);
        return (
          c.nome.toLowerCase().includes(s) ||
          c.matricula.includes(search) ||
          c.funcao.toLowerCase().includes(s) ||
          (c.cidade || "").toLowerCase().includes(s) ||
          matchCpf
        );
      }
      return true;
    });

    if (sortField && sortDir) {
      list = [...list].sort((a, b) => {
        let va = "",
          vb = "";
        switch (sortField) {
          case "matricula":
            va = a.matricula;
            vb = b.matricula;
            break;
          case "nome":
            va = a.nome;
            vb = b.nome;
            break;
          case "funcao":
            va = a.funcao;
            vb = b.funcao;
            break;
          case "cidade":
            va = a.cidade || "";
            vb = b.cidade || "";
            break;
          case "obra":
            va = getObraNome(a.obraAtualId);
            vb = getObraNome(b.obraAtualId);
            break;
        }
        const cmp = va.localeCompare(vb, "pt-BR");
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return list;
  }, [colaboradores, showInactive, search, sortField, sortDir, obras]);

  const openProfile = (id: string) => {
    if (!canEdit) return;
    setSelectedId(id);
    setProfileOpen(true);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    if (sortDir === "asc") return <ArrowUp className="h-3 w-3 ml-1" />;
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleExport = () => {
    const rows = colaboradores
      .filter((c) => c.ativo)
      .map((c) => {
        const feriasList = c.ferias || [];
        // Build base row
        const row: Record<string, any> = {
          Matrícula: c.matricula,
          Nome: c.nome,
          Gênero: c.genero,
          CEP: c.cep,
          Endereço: c.endereco,
          "Data Nascimento": c.dataNascimento,
          "Local Nascimento": c.cidade,
          Etnia: c.etnia,
          "Estado Civil": c.estadoCivil,
          Cônjuge: c.nomeConjuge,
          Mãe: c.nomeMae,
          Pai: c.nomePai,
          Nacionalidade: c.nacionalidade,
          RG: c.rg,
          "Emissão RG": c.dataEmissaoRG,
          "Órgão RG": c.orgaoEmissorRG,
          "UF RG": c.ufEmissorRG,
          CPF: formatCPF(c.cpf),
          "Emissão CPF": c.dataEmissaoCPF,
          PIS: c.pis,
          "Emissão PIS": c.dataEmissaoPIS,
          Admissão: c.dataAdmissao,
          Função: c.funcao,
          Salário: c.salario,
          "Forma Salário": c.formaSalario,
          Banco: c.banco || "",
          "Nº Banco": c.numeroBanco || "",
          Agência: c.agencia || "",
          "Nº Conta": c.numeroConta || "",
          "Tipo Conta": c.tipoConta || "",
          "Tipo Chave Pix": c.tipoChavePix || "",
          "Chave Pix": c.chavePix || "",
        };

        // Add all férias entries as numbered columns
        feriasList.forEach((f, i) => {
          const n = i + 1;
          row[`Férias ${n} Quitado`] = f.quitado ? "Sim" : "Não";
          row[`Férias ${n} Dias Quitados`] = f.diasQuitados || "";
          row[`Férias ${n} Afastamento`] = f.afastamento || "";
          row[`Férias ${n} Faltas`] = f.faltas || "";
          row[`Férias ${n} Vencimento`] = f.vencimento || "";
          row[`Férias ${n} Limite Concessão`] = f.limiteConcessao || "";
        });

        return row;
      });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
    XLSX.writeFile(wb, "colaboradores.xlsx");
  };

  const parseExcelDate = (value: any): string => {
    if (!value && value !== 0) return "";
    if (typeof value === "number") {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        const y = String(date.y).padStart(4, "0");
        const m = String(date.m).padStart(2, "0");
        const d = String(date.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
    const s = String(value);
    // Already in YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD/MM/YYYY
    const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return s;
  };

  const parseFeriasFromRow = (row: any): FeriasEntry[] => {
    const entries: FeriasEntry[] = [];
    let i = 1;
    // Continue while the columns exist in the sheet (even if empty)
    while (
      Object.prototype.hasOwnProperty.call(row, `Férias ${i} Vencimento`) ||
      Object.prototype.hasOwnProperty.call(row, `Férias ${i} Quitado`)
    ) {
      const vencimentoRaw = row[`Férias ${i} Vencimento`];
      const quitadoRaw = row[`Férias ${i} Quitado`];
      const vencimento = parseExcelDate(vencimentoRaw);
      const quitadoStr = String(quitadoRaw ?? "")
        .trim()
        .toLowerCase();

      // Skip entries that have neither a vencimento date nor a quitado flag
      if (!vencimento && !quitadoStr) {
        i++;
        continue;
      }

      entries.push({
        id: crypto.randomUUID(),
        quitado: quitadoStr === "sim",
        diasQuitados: String(row[`Férias ${i} Dias Quitados`] ?? ""),
        afastamento: String(row[`Férias ${i} Afastamento`] ?? ""),
        faltas: String(row[`Férias ${i} Faltas`] ?? ""),
        vencimento,
        limiteConcessao: parseExcelDate(row[`Férias ${i} Limite Concessão`]),
      });
      i++;
    }
    return entries;
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      const dups: any[] = [];
      const news: any[] = [];

      rows.forEach((row) => {
        const matricula = String(row["Matrícula"] || "").trim();
        const existing = colaboradores.find((c) => c.matricula === matricula);
        const feriasParsed = parseFeriasFromRow(row);
        const entry = {
          matricula,
          nome: row["Nome"] || "",
          genero: row["Gênero"] || "",
          cep: row["CEP"] || "",
          endereco: row["Endereço"] || "",
          dataNascimento: parseExcelDate(row["Data Nascimento"]),
          cidade: row["Local Nascimento"] || "",
          etnia: row["Etnia"] || "",
          estadoCivil: row["Estado Civil"] || "",
          nomeConjuge: row["Cônjuge"] || "",
          nomeMae: row["Mãe"] || "",
          nomePai: row["Pai"] || "",
          nacionalidade: row["Nacionalidade"] || "Brasileiro",
          rg: row["RG"] || "",
          dataEmissaoRG: parseExcelDate(row["Emissão RG"]),
          orgaoEmissorRG: row["Órgão RG"] || "",
          ufEmissorRG: row["UF RG"] || "",
          cpf: row["CPF"] || "",
          dataEmissaoCPF: parseExcelDate(row["Emissão CPF"]),
          pis: row["PIS"] || "",
          dataEmissaoPIS: parseExcelDate(row["Emissão PIS"]),
          dataAdmissao: parseExcelDate(row["Admissão"]),
          funcao: row["Função"] || "",
          salario: row["Salário"] || "",
          formaSalario: (row["Forma Salário"] || "mensal") as "mensal" | "horista",
          banco: row["Banco"] || "",
          numeroBanco: row["Nº Banco"] || "",
          agencia: row["Agência"] || "",
          numeroConta: row["Nº Conta"] || "",
          tipoConta: row["Tipo Conta"] || "",
          tipoChavePix: row["Tipo Chave Pix"] || "",
          chavePix: row["Chave Pix"] || "",
          ativo: true,
          obraAtualId: null,
          ferias: feriasParsed,
        };
        const validation = validateColaborador(entry, {
          colaboradores,
          editingId: existing?.id ?? null,
        });
        if (!validation.ok) return;

        if (existing) {
          // Importação só atualiza dados cadastrais + férias.
          // Não enviamos mobilizacaoPendente/obraAtualId/integracoes/documentos/historico
          // para evitar sobrescrever o estado atual desses campos no backend.
          dups.push({ ...entry, existingId: existing.id });
        } else {
          news.push(entry);
        }
      });

      if (dups.length > 0) {
        setDuplicates(dups);
        setNewEntries(news);
        setDupsOpen(true);
      } else {
        news.forEach((n) => addColaborador(n));
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDupsConfirm = (replace: boolean) => {
    newEntries.forEach((n) => addColaborador(n));
    if (replace) {
      duplicates.forEach((d) => {
        // Remove campos que não devem ser sobrescritos por uma importação cadastral:
        // existingId é controle interno; obraAtualId/ativo pertencem ao fluxo de mobilização/inativação.
        const { existingId, obraAtualId, ativo, ...data } = d;
        updateColaborador(existingId, data);
      });
    }
    setDupsOpen(false);
    setDuplicates([]);
    setNewEntries([]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Colaboradores
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="inativos" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="inativos" className="text-sm">
              {showInactive ? (
                <EyeOff className="h-4 w-4 inline" />
              ) : (
                <Eye className="h-4 w-4 inline" />
              )}{" "}
              Inativos
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Importar
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
              />
              <Button onClick={() => setFormOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, matrícula, função ou cidade..."
          className="pl-9"
        />
      </div>

      <div
        className="border border-border rounded-lg overflow-auto"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 sticky top-0 z-10">
              <TableHead
                className="w-[90px] cursor-pointer select-none"
                onClick={() => handleSort("matricula")}
              >
                <span className="flex items-center">
                  Matrícula <SortIcon field="matricula" />
                </span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("nome")}>
                <span className="flex items-center">
                  Nome <SortIcon field="nome" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("funcao")}
              >
                <span className="flex items-center">
                  Função <SortIcon field="funcao" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("cidade")}
              >
                <span className="flex items-center">
                  Cidade <SortIcon field="cidade" />
                </span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("obra")}>
                <span className="flex items-center">
                  Obra <SortIcon field="obra" />
                </span>
              </TableHead>
              {canEdit && <TableHead className="w-[80px]">Ação</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 6 : 5}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum colaborador encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => {
              const obraNome = getObraNome(c.obraAtualId);
              const statusColuna = c.statusEspecial ? rotuloStatus(String(c.statusEspecial)) : null;
              return (
                <ContextMenu key={c.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className={`${canEdit ? "cursor-pointer" : ""} ${
                        c.ativo && (c as any).dataInativacao ? "bg-red-50 dark:bg-red-950/20" : ""
                      }`}
                      onClick={() => openProfile(c.id)}
                    >
                      <TableCell>
                        <span className="matricula-badge">{c.matricula.padStart(4, "0")}</span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.nome}
                        {!c.ativo && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Inativo
                          </Badge>
                        )}
                        {c.ativo && (c as any).dataInativacao && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            🕐 Inativação: {String((c as any).dataInativacao).split("-").reverse().join("/")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.funcao}</TableCell>
                      <TableCell className="text-muted-foreground">{c.cidade || "—"}</TableCell>
                      <TableCell>
                        {obraNome ? (
                          <Badge variant="secondary" className="text-xs">
                            {obraNome}
                          </Badge>
                        ) : statusColuna ? (
                          // Quem está de férias, folga ou afastado tem
                          // obraAtualId nulo. Mostrar "—" aqui misturava esses
                          // casos com quem está de fato sem alocação.
                          <Badge
                            variant="outline"
                            className={cn("text-xs", STATUS_TONE_CLASSES[statusColuna.tone])}
                          >
                            {statusColuna.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          {c.ativo ? (
                            (c as any).dataInativacao ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateColaborador(c.id, {
                                    dataInativacao: null as any,
                                    motivoInativacao: null as any,
                                    dataRescisao: null as any,
                                    historico: [
                                      ...c.historico,
                                      {
                                        id: crypto.randomUUID(),
                                        tipo: "outro",
                                        descricao: "Inativação programada cancelada",
                                        data: new Date().toISOString(),
                                        usuario: currentPlayer?.login || "Sistema",
                                      },
                                    ],
                                  });
                                }}
                              >
                                Cancelar
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInativarTarget(c);
                                  setIsRescisao(false);
                                  setDataRescisao("");
                                  setDataInativacao(new Date().toISOString().split("T")[0]);
                                }}
                              >
                                Inativar
                              </Button>
                            )
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateColaborador(c.id, {
                                  ativo: true,
                                  historico: [
                                    ...c.historico,
                                    {
                                      id: crypto.randomUUID(),
                                      tipo: "outro",
                                      descricao: "Reativado",
                                      data: new Date().toISOString(),
                                      usuario: currentPlayer?.login || "Sistema",
                                    },
                                  ],
                                });
                              }}
                            >
                              Ativar
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  </ContextMenuTrigger>
                  {isGM && (
                    <ContextMenuContent>
                      <ContextMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget({ id: c.id, nome: c.nome })}
                      >
                        Excluir
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <EmployeeFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <EmployeeProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        colaboradorId={selectedId}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteColaborador(deleteTarget.id)}
        title="Excluir Colaborador"
        description={`Deseja realmente excluir "${deleteTarget?.nome}"? Esta ação é irreversível.`}
      />

      {/* Duplicate Import Dialog */}
      <Dialog open={dupsOpen} onOpenChange={(v) => !v && setDupsOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Duplicatas Encontradas</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Foram encontrados <strong>{duplicates.length}</strong> colaboradores com matrícula já
            existente.
            {newEntries.length > 0 && (
              <>
                {" "}
                E <strong>{newEntries.length}</strong> novos serão adicionados.
              </>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Deseja substituir os dados cadastrais dos duplicados?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleDupsConfirm(false)}>
              Manter Existentes
            </Button>
            <Button onClick={() => handleDupsConfirm(true)}>Substituir Dados</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inativação Dialog */}
      <Dialog
        open={!!inativarTarget}
        onOpenChange={(v) => {
          if (!v) setInativarTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Inativar Colaborador</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Inativar <strong>{inativarTarget?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          {(() => {
            if (!inativarTarget) return null;
            const hoje = new Date().toISOString().split("T")[0];
            const abertas = responsabilidadesPatrimonios.filter(
              (r) =>
                r.colaboradorId === inativarTarget.id && (r.dataFim === null || r.dataFim >= hoje),
            );
            if (abertas.length === 0) return null;
            return (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs space-y-1">
                <p className="font-semibold text-warning">
                  Este colaborador é responsável por {abertas.length} patrimônio
                  {abertas.length > 1 ? "s" : ""}:
                </p>
                <ul className="list-disc ml-4 text-warning max-h-24 overflow-auto">
                  {abertas.map((r) => {
                    const p = patrimonios.find((x) => x.id === r.patrimonioId);
                    return (
                      <li key={r.id}>
                        {p?.codigo} — {p?.nome || r.patrimonioId}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-warning mt-2">
                  Ao confirmar, eles serão movidos para <strong>Sem Alocação</strong>.
                </p>
              </div>
            );
          })()}
          <div>
            <Label className="text-sm">Data efetiva da inativação</Label>
            <DatePickerField
              value={dataInativacao}
              onChange={setDataInativacao}
              className="mt-1"
            />
            {dataInativacao > new Date().toISOString().split("T")[0] && (
              <p className="text-xs text-muted-foreground mt-1">
                A inativação ficará <strong>programada</strong> e será aplicada automaticamente
                nesta data.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
            <Checkbox
              checked={isRescisao}
              onCheckedChange={(v) => {
                setIsRescisao(!!v);
                if (!v) setDataRescisao("");
              }}
            />
            <span className="text-sm font-medium">É uma rescisão?</span>
          </div>
          {isRescisao && (
            <div>
              <Label className="text-sm">Data da Rescisão</Label>
              <DatePickerField value={dataRescisao} onChange={setDataRescisao} className="mt-1" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInativarTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!dataInativacao || (isRescisao && !dataRescisao)}
              onClick={async () => {
                if (!inativarTarget) return;
                const hoje = new Date().toISOString().split("T")[0];
                const dataEf = dataInativacao || hoje;
                const isFutura = dataEf > hoje;
                const colab = colaboradores.find((c) => c.id === inativarTarget.id);
                const historicoBase = colab?.historico || [];
                const motivoLabel = isRescisao ? "Rescisão" : "Outro motivo";
                const dataDescr =
                  isRescisao && dataRescisao ? ` — data da rescisão: ${dataRescisao}` : "";
                const descricao = isFutura
                  ? `Inativação programada para ${dataEf} (${motivoLabel})${dataDescr}`
                  : `Status alterado para Inativo (${motivoLabel})${dataDescr}`;
                const novaEntrada = {
                  id: crypto.randomUUID(),
                  tipo: "outro" as const,
                  descricao,
                  data: new Date().toISOString(),
                  usuario: currentPlayer?.login || "Sistema",
                };
                const updates: Partial<Colaborador> = {
                  ...(isFutura ? {} : { ativo: false }),
                  dataInativacao: dataEf,
                  motivoInativacao: isRescisao ? "rescisao" : "outro",
                  historico: [...historicoBase, novaEntrada],
                  ...(isRescisao && dataRescisao ? { dataRescisao } : {}),
                };
                if (!isFutura) {
                  await encerrarResponsabilidadesDoColaborador(inativarTarget.id, dataEf);
                }
                updateColaborador(inativarTarget.id, updates);
                setInativarTarget(null);
                setIsRescisao(false);
                setDataRescisao("");
                setDataInativacao("");
              }}
            >
              {dataInativacao > new Date().toISOString().split("T")[0]
                ? "Programar Inativação"
                : "Confirmar Inativação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Colaboradores;
