import React, { useState, useMemo, useRef, useEffect } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useContratosContext } from "@/contexts/ContratosContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Upload,
  Download,
  Files,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StatusFilter from "@/components/common/StatusFilter";
import { Textarea } from "@/components/ui/textarea";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import ContratoProfileDialog, {
  TIPOS_CONTRATO,
  STATUS_CONTRATO,
} from "@/components/contratos/ContratoProfileDialog";
import DatePickerField from "@/components/common/DatePickerField";
import { formatBRLInput, parseBRL, formatBRLFromNumber } from "@/lib/core/currency";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { TipoContrato, StatusContrato } from "@/types";
import { useFormasPagamento } from "@/hooks/financeiro/useFormasPagamento";
import {
  filtrarContratosCronograma,
  projetarLista,
  projetarPorObraMes,
  projetarPorContratoMes,
  SEM_OBRA_KEY,
} from "@/lib/contratos/recorrencia";
import {
  getDocumentoNumeroLocal,
  listDocumentoNumeracaoLocal,
} from "@/lib/empresa/documento-numeracao-local";
import { swallow } from "@/lib/core/errors";

type SortField =
  | "locacao"
  | "tipo"
  | "inicio"
  | "termino"
  | "valor"
  | "responsavel"
  | "obra"
  | "status";
type SortDir = "asc" | "desc" | null;
const CRONOGRAMA_TODAS_OBRAS_KEY = "__todas_obras__";

const Contratos = () => {
  const { contratos, addContrato, updateContrato, deleteContrato } = useContratosContext();
  const { hasAccess, currentPlayer } = usePermissions();
  const { obras } = useObrasContext();
  const canEdit = hasAccess("contratos", "editar");
  const isGM = currentPlayer?.isGM;
  const [search, setSearch] = useState("");
  const [statusSelecionados, setStatusSelecionados] = useState<Set<string>>(
    new Set(STATUS_CONTRATO.map((s) => s.value)),
  );
  const [dataFrom, setDataFrom] = useState("");
  const [dataTo, setDataTo] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const { data: formasPagamentoAll = [] } = useFormasPagamento();
  const formasPagamento = formasPagamentoAll.filter((f) => f.ativo);

  // Form state
  const [fLocacao, setFLocacao] = useState("");
  const [fInicio, setFInicio] = useState("");
  const [fTermino, setFTermino] = useState("");
  const [fResponsavel, setFResponsavel] = useState("");
  const [fContato, setFContato] = useState("");
  const [fValorMasked, setFValorMasked] = useState("");
  const [fFormaPag, setFFormaPag] = useState("");
  const [fTipo, setFTipo] = useState<TipoContrato>("Outro");
  const [fObservacao, setFObservacao] = useState("");
  const [fStatus, setFStatus] = useState<StatusContrato>("rascunho");

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // PRO-031.slice-19 — mapa de números customizados por contrato.
  const numeracoesContrato = useMemo(
    () => listDocumentoNumeracaoLocal("contrato"),
    // recomputa quando lista de contratos muda (novos ids -> novos números)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contratos.length],
  );
  const numeroContratoById = useMemo(
    () => new Map(numeracoesContrato.map((n) => [n.documentoId, n.numero])),
    [numeracoesContrato],
  );
  const numeroContrato = (id: string) =>
    numeroContratoById.get(id) ??
    getDocumentoNumeroLocal(id, "contrato")?.numero ??
    `CTR-${id.slice(-6).toUpperCase()}`;

  const openForm = () => {
    setFLocacao("");
    setFInicio("");
    setFTermino("");
    setFResponsavel("");
    setFContato("");
    setFValorMasked("");
    setFFormaPag("");
    setFTipo("Outro");
    setFObservacao("");
    setFStatus("rascunho");
    setFormOpen(true);
  };

  const handleAdd = () => {
    if (!fLocacao) return;
    void addContrato({
      locacaoServico: fLocacao,
      inicio: fInicio,
      termino: fTermino,
      responsavel: fResponsavel,
      contato: fContato,
      valor: parseBRL(fValorMasked),
      formaPagamentoId: fFormaPag || undefined,
      tipo: fTipo,
      observacao: fObservacao,
      status: fStatus,
      ativo: true,
      obraAtualId: null,
      ocioso: false,
    });
    setFormOpen(false);
  };

  const getObraNome = (obraId: string | null) =>
    obraId ? obras.find((o) => o.id === obraId)?.nome || "" : "";

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

  const toIsoDate = (s: string): string => {
    if (!s) return "";
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return "";
  };

  const valorComReajustes = (c: (typeof contratos)[number]) => {
    const ad = [...(c.aditivos || [])].sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime(),
    );
    return ad.reduce(
      (acc, a) => (a.tipo === "reajuste" && a.novoValor != null ? a.novoValor : acc),
      c.valor,
    );
  };

  const filtered = useMemo(() => {
    let list = contratos.filter((c) => {
      if (!showInactive && !c.ativo) return false;
      if (showInactive && c.ativo) return false;
      if (!statusSelecionados.has(c.status)) return false;
      const inicioIso = toIsoDate(c.inicio);
      if (dataFrom && (!inicioIso || inicioIso < dataFrom)) return false;
      if (dataTo && (!inicioIso || inicioIso > dataTo)) return false;
      if (search) {
        const s = search.toLowerCase();
        const obraNome = getObraNome(c.obraAtualId).toLowerCase();
        return (
          c.locacaoServico.toLowerCase().includes(s) ||
          c.tipo.toLowerCase().includes(s) ||
          c.responsavel.toLowerCase().includes(s) ||
          obraNome.includes(s)
        );
      }
      return true;
    });
    if (sortField && sortDir) {
      list = [...list].sort((a, b) => {
        let va: string | number = "",
          vb: string | number = "";
        switch (sortField) {
          case "locacao":
            va = a.locacaoServico;
            vb = b.locacaoServico;
            break;
          case "tipo":
            va = a.tipo;
            vb = b.tipo;
            break;
          case "inicio":
            va = a.inicio;
            vb = b.inicio;
            break;
          case "termino":
            va = a.termino;
            vb = b.termino;
            break;
          case "valor":
            va = a.valor;
            vb = b.valor;
            break;
          case "responsavel":
            va = a.responsavel;
            vb = b.responsavel;
            break;
          case "obra":
            va = getObraNome(a.obraAtualId);
            vb = getObraNome(b.obraAtualId);
            break;
          case "status":
            va = a.status;
            vb = b.status;
            break;
        }
        const cmp =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : String(va).localeCompare(String(vb), "pt-BR");
        return sortDir === "desc" ? -cmp : cmp;
      });
    }
    return list;
  }, [
    contratos,
    showInactive,
    search,
    statusSelecionados,
    dataFrom,
    dataTo,
    sortField,
    sortDir,
    obras,
  ]);

  const totalValor = useMemo(
    () => filtered.reduce((s, c) => s + valorComReajustes(c), 0),
    [filtered],
  );

  // PRO-020.slice-01 — Projeção de despesa recorrente (mensal / total até término).
  const projecaoRecorrencia = useMemo(
    () =>
      projetarLista(
        filtered.map((c) => ({
          valor: valorComReajustes(c),
          inicio: c.inicio,
          termino: c.termino,
          status: c.status,
          ativo: c.ativo,
        })),
      ),
    [filtered],
  );

  // PRO-020.slice-02/03/04 — Cronograma de recorrência por obra × mês.
  // slice-04: horizonte persistido em localStorage.
  const HORIZONTE_KEY = "gestaobra:contratos:cronograma:horizonte";
  const [horizonteMeses, setHorizonteMeses] = useState<number>(() => {
    if (typeof window === "undefined") return 6;
    const raw = Number(window.localStorage.getItem(HORIZONTE_KEY));
    return [3, 6, 12, 24].includes(raw) ? raw : 6;
  });
  const [cronogramaStatusFiltro, setCronogramaStatusFiltro] = useState<"recorrentes" | "ativo">(
    "recorrentes",
  );
  const [cronogramaObraFiltro, setCronogramaObraFiltro] = useState<string>(
    CRONOGRAMA_TODAS_OBRAS_KEY,
  );
  useEffect(() => {
    try {
      window.localStorage.setItem(HORIZONTE_KEY, String(horizonteMeses));
    } catch (err) {
      swallow("contratos.hub.horizonte", err, "localStorage indisponível");
    }
  }, [horizonteMeses]);

  const contratosCronogramaBase = useMemo(
    () =>
      filtered.map((c) => ({
        id: c.id,
        locacaoServico: c.locacaoServico,
        valor: valorComReajustes(c),
        inicio: c.inicio,
        termino: c.termino,
        status: c.status,
        ativo: c.ativo,
        obraAtualId: c.obraAtualId,
      })),
    [filtered],
  );

  const contratosCronogramaPorStatus = useMemo(
    () =>
      filtrarContratosCronograma(contratosCronogramaBase, {
        somenteStatusAtivo: cronogramaStatusFiltro === "ativo",
      }),
    [contratosCronogramaBase, cronogramaStatusFiltro],
  );

  const obrasFiltroCronograma = useMemo(() => {
    const chaves = new Set<string>();
    contratosCronogramaPorStatus.forEach((c) => chaves.add(c.obraAtualId ?? SEM_OBRA_KEY));
    return Array.from(chaves).sort((a, b) => {
      if (a === SEM_OBRA_KEY) return 1;
      if (b === SEM_OBRA_KEY) return -1;
      return (getObraNome(a) || "").localeCompare(getObraNome(b) || "");
    });
  }, [contratosCronogramaPorStatus, obras]);

  useEffect(() => {
    if (
      cronogramaObraFiltro !== CRONOGRAMA_TODAS_OBRAS_KEY &&
      !obrasFiltroCronograma.includes(cronogramaObraFiltro)
    ) {
      setCronogramaObraFiltro(CRONOGRAMA_TODAS_OBRAS_KEY);
    }
  }, [cronogramaObraFiltro, obrasFiltroCronograma]);

  const contratosCronograma = useMemo(
    () =>
      filtrarContratosCronograma(contratosCronogramaPorStatus, {
        obraAtualId:
          cronogramaObraFiltro === CRONOGRAMA_TODAS_OBRAS_KEY
            ? undefined
            : cronogramaObraFiltro === SEM_OBRA_KEY
              ? null
              : cronogramaObraFiltro,
      }),
    [contratosCronogramaPorStatus, cronogramaObraFiltro],
  );

  const cronogramaObraMes = useMemo(
    () => projetarPorObraMes(contratosCronograma, horizonteMeses),
    [contratosCronograma, horizonteMeses],
  );
  const obrasCronograma = useMemo(() => {
    const chaves = new Set<string>();
    cronogramaObraMes.forEach((l) => Object.keys(l.porObra).forEach((k) => chaves.add(k)));
    return Array.from(chaves).sort((a, b) => {
      if (a === SEM_OBRA_KEY) return 1;
      if (b === SEM_OBRA_KEY) return -1;
      return (getObraNome(a) || "").localeCompare(getObraNome(b) || "");
    });
  }, [cronogramaObraMes, obras]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    if (sortDir === "asc") return <ArrowUp className="h-3 w-3 ml-1" />;
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        let added = 0;
        let ignoradosNumeroDuplicado = 0;
        const numerosReservados = new Set(
          listDocumentoNumeracaoLocal("contrato").map((n) =>
            n.numero.trim().toLocaleLowerCase("pt-BR"),
          ),
        );
        for (const row of rows) {
          const locacao = String(
            row["Locação/Serviços"] || row["Locação"] || row["Nome"] || "",
          ).trim();
          if (!locacao) continue;
          const numeroImportado = String(
            row["Nº"] || row["N°"] || row["Número"] || row["Numero"] || row["No"] || "",
          ).trim();
          const chaveNumeroImportado = numeroImportado.toLocaleLowerCase("pt-BR");
          if (numeroImportado && numerosReservados.has(chaveNumeroImportado)) {
            ignoradosNumeroDuplicado++;
            continue;
          }
          const tipo = String(row["Tipo"] || "Outro").trim() as TipoContrato;
          const criado = await addContrato(
            {
              locacaoServico: locacao,
              inicio: String(row["Início"] || ""),
              termino: String(row["Término"] || ""),
              responsavel: String(row["Responsável"] || ""),
              contato: String(row["Contato"] || ""),
              valor:
                parseFloat(
                  String(row["Valor"] || "0")
                    .replace(/[^\d,]/g, "")
                    .replace(",", "."),
                ) || 0,
              tipo: TIPOS_CONTRATO.includes(tipo) ? tipo : "Outro",
              observacao: String(row["Observação"] || ""),
              status: "rascunho",
              ativo: true,
              obraAtualId: null,
              ocioso: false,
            },
            numeroImportado ? { numeroDocumento: numeroImportado } : undefined,
          );
          if (criado) {
            added++;
            if (numeroImportado) numerosReservados.add(chaveNumeroImportado);
          }
        }
        const complemento = ignoradosNumeroDuplicado
          ? ` ${ignoradosNumeroDuplicado} linha(s) ignorada(s) por Nº duplicado.`
          : "";
        toast.success(`Importação concluída: ${added} contratos.${complemento}`);
      } catch {
        toast.error("Erro ao processar o arquivo.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const data = contratos.map((c) => ({
      Nº: numeroContrato(c.id),
      "Locação/Serviços": c.locacaoServico,
      Tipo: c.tipo,
      Início: c.inicio,
      Término: c.termino,
      Responsável: c.responsavel,
      Contato: c.contato,
      Valor: c.valor,
      Status: STATUS_CONTRATO.find((s) => s.value === c.status)?.label || c.status,
      "Obra Atual": getObraNome(c.obraAtualId) || "—",
      Ativo: c.ativo ? "Sim" : "Não",
      Observação: c.observacao || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contratos");
    XLSX.writeFile(wb, "contratos.xlsx");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Files className="h-6 w-6" /> Contratos
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="inativos-cont" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="inativos-cont" className="text-sm">
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
          {isGM && (
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
            </>
          )}
          {canEdit && (
            <Button onClick={openForm} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
        <StatusFilter
          options={STATUS_CONTRATO.map((s) => ({ value: s.value, label: s.label }))}
          selected={statusSelecionados}
          onChange={setStatusSelecionados}
        />
        <div className="flex items-center gap-1 ml-auto">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Início de</Label>
          <DatePickerField
            value={dataFrom}
            onChange={(v) => setDataFrom(v)}
            className="w-[140px]"
            inputClassName="h-9 text-xs"
          />
          <Label className="text-xs text-muted-foreground whitespace-nowrap">até</Label>
          <DatePickerField
            value={dataTo}
            onChange={(v) => setDataTo(v)}
            className="w-[140px]"
            inputClassName="h-9 text-xs"
          />
          {(dataFrom || dataTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDataFrom("");
                setDataTo("");
              }}
              className="h-9 px-2 text-xs"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total de Contratos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRLFromNumber(totalValor)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Status Selecionados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {statusSelecionados.size === STATUS_CONTRATO.length
                ? "Todos"
                : `${statusSelecionados.size} de ${STATUS_CONTRATO.length}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Recorrência prevista (mensal)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatBRLFromNumber(projecaoRecorrencia.mensalTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {projecaoRecorrencia.contratosElegiveis} contrato(s) · total até término{" "}
              {formatBRLFromNumber(projecaoRecorrencia.totalPrevisto)}
            </p>
          </CardContent>
        </Card>
      </div>

      {contratosCronogramaBase.length > 0 && (
        <details className="mb-4 border border-border rounded-lg bg-card">
          <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium">
            Cronograma de recorrência por obra (próximos {horizonteMeses} meses)
          </summary>
          <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-muted/20">
            <Label htmlFor="cronoHorizonte" className="text-xs text-muted-foreground">
              Horizonte
            </Label>
            <Select
              value={String(horizonteMeses)}
              onValueChange={(v) => setHorizonteMeses(Number(v))}
            >
              <SelectTrigger id="cronoHorizonte" className="h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 6, 12, 24].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} meses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label
              htmlFor="cronoStatus"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              Status
            </Label>
            <Select
              value={cronogramaStatusFiltro}
              onValueChange={(v) => setCronogramaStatusFiltro(v as "recorrentes" | "ativo")}
            >
              <SelectTrigger id="cronoStatus" className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recorrentes">Recorrentes</SelectItem>
                <SelectItem value="ativo">Só status ativo</SelectItem>
              </SelectContent>
            </Select>
            <Label htmlFor="cronoObra" className="text-xs text-muted-foreground whitespace-nowrap">
              Obra
            </Label>
            <Select value={cronogramaObraFiltro} onValueChange={setCronogramaObraFiltro}>
              <SelectTrigger id="cronoObra" className="h-8 w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CRONOGRAMA_TODAS_OBRAS_KEY}>Todas</SelectItem>
                {obrasFiltroCronograma.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k === SEM_OBRA_KEY ? "— sem obra —" : getObraNome(k) || k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                const header = ["Obra", ...cronogramaObraMes.map((l) => l.mesISO), "Total"];
                const rows = obrasCronograma.map((k) => {
                  const nome = k === SEM_OBRA_KEY ? "— sem obra —" : getObraNome(k) || k;
                  const vals = cronogramaObraMes.map((l) => l.porObra[k] ?? 0);
                  const tot = vals.reduce((a, b) => a + b, 0);
                  return [nome, ...vals, tot];
                });
                const totalRow = [
                  "Total",
                  ...cronogramaObraMes.map((l) => l.total),
                  cronogramaObraMes.reduce((a, l) => a + l.total, 0),
                ];
                const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Cronograma");
                XLSX.writeFile(
                  wb,
                  `cronograma_contratos_${horizonteMeses}m_${new Date()
                    .toISOString()
                    .slice(0, 10)}.xlsx`,
                );
                toast.success("Cronograma exportado");
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Exportar XLSX
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const proj = projetarPorContratoMes(contratosCronograma, horizonteMeses);
                const nomeContrato = (id: string) => {
                  const c = contratosCronograma.find((x) => x.id === id);
                  return c?.locacaoServico ?? id;
                };
                const header = ["Nº", "Contrato", "Obra", ...proj.meses, "Total"];
                const rows = proj.linhas.map((l) => [
                  numeroContrato(l.id),
                  nomeContrato(l.id),
                  l.obraAtualId ? getObraNome(l.obraAtualId) || l.obraAtualId : "— sem obra —",
                  ...proj.meses.map((m) => l.porMes[m] ?? 0),
                  l.total,
                ]);
                const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Por contrato");
                XLSX.writeFile(
                  wb,
                  `cronograma_por_contrato_${horizonteMeses}m_${new Date()
                    .toISOString()
                    .slice(0, 10)}.xlsx`,
                );
                toast.success("Cronograma por contrato exportado");
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Por contrato
            </Button>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[180px]">Obra</TableHead>
                  {cronogramaObraMes.map((l) => (
                    <TableHead key={l.mesISO} className="text-right whitespace-nowrap">
                      {l.mesISO}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {obrasCronograma.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={cronogramaObraMes.length + 1}
                      className="text-center text-sm text-muted-foreground py-6"
                    >
                      Nenhum contrato recorrente para os filtros do cronograma.
                    </TableCell>
                  </TableRow>
                ) : (
                  obrasCronograma.map((obraKey) => (
                    <TableRow key={obraKey}>
                      <TableCell className="font-medium">
                        {obraKey === SEM_OBRA_KEY
                          ? "— sem obra —"
                          : getObraNome(obraKey) || obraKey}
                      </TableCell>
                      {cronogramaObraMes.map((l) => (
                        <TableCell key={l.mesISO} className="text-right tabular-nums">
                          {l.porObra[obraKey] ? formatBRLFromNumber(l.porObra[obraKey]) : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
                {obrasCronograma.length > 0 && (
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell>Total</TableCell>
                    {cronogramaObraMes.map((l) => (
                      <TableCell key={l.mesISO} className="text-right tabular-nums">
                        {formatBRLFromNumber(l.total)}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </details>
      )}

      <div
        className="border border-border rounded-lg overflow-auto"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 sticky top-0 z-10">
              <TableHead className="w-[130px]">Nº</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("locacao")}
              >
                <span className="flex items-center">
                  Locação/Serviços <SortIcon field="locacao" />
                </span>
              </TableHead>
              <TableHead
                className="w-[130px] cursor-pointer select-none"
                onClick={() => handleSort("tipo")}
              >
                <span className="flex items-center">
                  Tipo <SortIcon field="tipo" />
                </span>
              </TableHead>
              <TableHead
                className="w-[110px] cursor-pointer select-none"
                onClick={() => handleSort("inicio")}
              >
                <span className="flex items-center">
                  Início <SortIcon field="inicio" />
                </span>
              </TableHead>
              <TableHead
                className="w-[110px] cursor-pointer select-none"
                onClick={() => handleSort("termino")}
              >
                <span className="flex items-center">
                  Término <SortIcon field="termino" />
                </span>
              </TableHead>
              <TableHead
                className="w-[120px] cursor-pointer select-none"
                onClick={() => handleSort("valor")}
              >
                <span className="flex items-center">
                  Valor <SortIcon field="valor" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("responsavel")}
              >
                <span className="flex items-center">
                  Responsável <SortIcon field="responsavel" />
                </span>
              </TableHead>
              <TableHead
                className="w-[150px] cursor-pointer select-none"
                onClick={() => handleSort("obra")}
              >
                <span className="flex items-center">
                  Obra <SortIcon field="obra" />
                </span>
              </TableHead>
              <TableHead
                className="w-[120px] cursor-pointer select-none"
                onClick={() => handleSort("status")}
              >
                <span className="flex items-center">
                  Status <SortIcon field="status" />
                </span>
              </TableHead>
              {canEdit && <TableHead className="w-[80px]">Ação</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 10 : 9}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum contrato encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => {
              const status =
                STATUS_CONTRATO.find((s) => s.value === c.status) || STATUS_CONTRATO[0];
              return (
                <ContextMenu key={c.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className={canEdit ? "cursor-pointer" : ""}
                      onClick={() => {
                        setSelectedId(c.id);
                        setProfileOpen(true);
                      }}
                    >
                      <TableCell className="text-xs font-mono">
                        <Badge variant="outline" className="text-[10px]">
                          {numeroContrato(c.id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{c.locacaoServico}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {c.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{c.inicio || "—"}</TableCell>
                      <TableCell className="text-xs">{c.termino || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {formatBRLFromNumber(c.valor) || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{c.responsavel || "—"}</TableCell>
                      <TableCell>
                        {c.obraAtualId ? (
                          <Badge variant="secondary" className="text-xs">
                            {getObraNome(c.obraAtualId)}
                          </Badge>
                        ) : c.ocioso ? (
                          <Badge variant="outline" className="text-xs">
                            Ocioso
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${status.className}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateContrato(c.id, { ativo: !c.ativo });
                            }}
                          >
                            {c.ativo ? "Inativar" : "Ativar"}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  </ContextMenuTrigger>
                  {isGM && (
                    <ContextMenuContent>
                      <ContextMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget({ id: c.id, nome: c.locacaoServico })}
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

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Adicionar Contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label className="text-xs">Locação/Serviços</Label>
              <Input
                value={fLocacao}
                onChange={(e) => setFLocacao(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Início</Label>
                <DatePickerField value={fInicio} onChange={setFInicio} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Término</Label>
                <DatePickerField value={fTermino} onChange={setFTermino} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Responsável</Label>
                <Input
                  value={fResponsavel}
                  onChange={(e) => setFResponsavel(e.target.value)}
                  className="mt-1"
                  placeholder="Dono da casa, fornecedor, profissional"
                />
              </div>
              <div>
                <Label className="text-xs">Contato</Label>
                <Input
                  value={fContato}
                  onChange={(e) => setFContato(e.target.value)}
                  className="mt-1"
                  placeholder="Nº de telefone do responsável"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor</Label>
                <Input
                  value={fValorMasked}
                  onChange={(e) => setFValorMasked(formatBRLInput(e.target.value))}
                  className="mt-1"
                  placeholder="R$ 0,00"
                />
              </div>
              <div>
                <Label className="text-xs">Forma de Pagamento</Label>
                <Select value={fFormaPag} onValueChange={setFFormaPag}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {formasPagamento.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={fTipo} onValueChange={(v) => setFTipo(v as TipoContrato)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTRATO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={fStatus} onValueChange={(v) => setFStatus(v as StatusContrato)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_CONTRATO.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Textarea
                value={fObservacao}
                onChange={(e) => setFObservacao(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={!fLocacao}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContratoProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        contratoId={selectedId}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteContrato(deleteTarget.id)}
        title="Excluir Contrato"
        description={`Deseja realmente excluir "${deleteTarget?.nome}"? Esta ação é irreversível.`}
      />
    </div>
  );
};

export default Contratos;
