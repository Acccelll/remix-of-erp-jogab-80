import { Link } from "react-router-dom";
import { useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Database,
  Clock,
  AlertCircle,
} from "lucide-react";
import { financeiroRepo } from "@/lib/repositories/financeiro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseMatriz, validarHeaderMatriz } from "@/lib/financeiro-totvs/parse";
import type { MatrizRateioParsed } from "@/lib/financeiro-totvs/types";
import { fmtData } from "@/lib/utils";
import {
  useImportCadencia,
  useTotvsImportStatus,
  CADENCIA_LABEL,
  type ImportCadencia,
} from "@/hooks/financeiro/useTotvsImportStatus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ParsedMatriz = {
  rateios: MatrizRateioParsed[];
  nomeArquivo: string;
};

async function readWorkbook(file: File): Promise<any[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.includes("Sheet") ? "Sheet" : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function ImportarTotvs() {
  // ---------- Matriz (única fonte) ----------
  const matrizRef = useRef<HTMLInputElement>(null);
  const [matrizFile, setMatrizFile] = useState<File | null>(null);
  const [parsedMatriz, setParsedMatriz] = useState<ParsedMatriz | null>(null);
  const [parsingMatriz, setParsingMatriz] = useState(false);
  const [importingMatriz, setImportingMatriz] = useState(false);
  const [matrizResult, setMatrizResult] = useState<{
    total_rateios: number;
    titulos_distintos: number;
    novos: number;
    alterados: number;
    removidos: number;
    inalterados: number;
    snapshots_reprocessados: number;
  } | null>(null);
  const [matrizError, setMatrizError] = useState<string | null>(null);
  const [matrizDataRef, setMatrizDataRef] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );

  // Última matriz carregada
  const { data: matrizInfo, refetch: refetchMatriz } = useQuery({
    queryKey: ["fin_matriz_info"],
    queryFn: async () => financeiroRepo.getMatrizInfo(),
  });

  async function validarMatriz() {
    if (!matrizFile) return;
    setParsingMatriz(true);
    try {
      const rows = await readWorkbook(matrizFile);
      validarHeaderMatriz(rows);
      const rateios = parseMatriz(rows);
      if (rateios.length === 0) {
        toast.error("Nenhuma fatia reconhecida na matriz.");
        setParsingMatriz(false);
        return;
      }
      setParsedMatriz({ rateios, nomeArquivo: matrizFile.name });
      const titulos = new Set(rateios.map((r) => r.ref_lancamento)).size;
      toast.success(`${rateios.length} fatias · ${titulos} títulos prontos.`);
    } catch (err: any) {
      toast.error(`Falha ao ler matriz: ${err.message ?? err}`);
    } finally {
      setParsingMatriz(false);
    }
  }

  async function importarMatriz() {
    if (!parsedMatriz) return;
    setImportingMatriz(true);
    setMatrizError(null);
    setMatrizResult(null);
    try {
      const res = await financeiroRepo.rpcImportarMatriz(
        parsedMatriz.rateios as any,
        matrizDataRef || null,
      );

      const resultado = {
        total_rateios: Number(res.total_rateios ?? 0),
        titulos_distintos: Number(res.titulos_distintos ?? 0),
        novos: Number(res.novos ?? 0),
        alterados: Number(res.alterados ?? 0),
        removidos: Number(res.removidos ?? 0),
        inalterados: Number(res.inalterados ?? 0),
        snapshots_reprocessados: Number(res.snapshots_reprocessados ?? 0),
      };
      setMatrizResult(resultado);
      const tocou = resultado.novos + resultado.alterados + resultado.removidos;
      if (tocou === 0) {
        toast.success("Matriz já estava sincronizada — nenhuma alteração aplicada.");
      } else {
        toast.success(
          `Matriz sincronizada: ${resultado.novos} novos · ${resultado.alterados} alterados · ${resultado.removidos} removidos.`,
        );
      }
      setParsedMatriz(null);
      setMatrizFile(null);
      if (matrizRef.current) matrizRef.current.value = "";
      await refetchMatriz();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setMatrizError(msg);
      toast.error(`Falha ao sincronizar matriz: ${msg}`);
    } finally {
      setImportingMatriz(false);
    }
  }

  const resumoPrevia = useMemo(() => {
    if (!parsedMatriz) return null;
    return {
      fatias: parsedMatriz.rateios.length,
      titulos: new Set(parsedMatriz.rateios.map((r) => r.ref_lancamento)).size,
    };
  }, [parsedMatriz]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header>
        <Link
          to="/financeiro/lancamentos"
          className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar para Financeiro
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Importar Matriz SQL</h1>
        <p className="text-sm text-muted-foreground">
          A <strong>Matriz SQL</strong> é a única fonte de dados financeiros: valores, naturezas,
          rateios, status e a série histórica da evolução de dívidas.
        </p>
      </header>

      <CadenciaCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Matriz (EMISSAO via SQL)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {matrizInfo?.atualizado_em ? (
              <>
                Última matriz carregada em <strong>{fmtData(matrizInfo.atualizado_em)}</strong> ·{" "}
                {matrizInfo.total.toLocaleString("pt-BR")} fatias.
              </>
            ) : (
              <>Nenhuma matriz carregada ainda.</>
            )}
          </div>
          <div className="grid md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Arquivo da matriz (.xlsx)</Label>
              <Input
                ref={matrizRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  setMatrizFile(e.target.files?.[0] ?? null);
                  setParsedMatriz(null);
                  setMatrizResult(null);
                  setMatrizError(null);
                }}
              />
              {matrizFile && <p className="text-xs text-muted-foreground">{matrizFile.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="matriz-data-ref">Data de referência</Label>
              <Input
                id="matriz-data-ref"
                type="date"
                className="w-[170px]"
                value={matrizDataRef}
                onChange={(e) => setMatrizDataRef(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Alimenta a evolução de dívidas.</p>
            </div>

            <Button
              variant="outline"
              onClick={validarMatriz}
              disabled={parsingMatriz || !matrizFile}
            >
              {parsingMatriz ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Lendo…
                </>
              ) : (
                "Validar"
              )}
            </Button>
            <Button onClick={importarMatriz} disabled={!parsedMatriz || importingMatriz}>
              {importingMatriz ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Comparando e atualizando…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Sincronizar matriz
                </>
              )}
            </Button>
          </div>
          {resumoPrevia && (
            <div className="text-xs text-muted-foreground">
              {resumoPrevia.fatias.toLocaleString("pt-BR")} fatias ·{" "}
              {resumoPrevia.titulos.toLocaleString("pt-BR")} títulos distintos prontos. A
              sincronização aplica apenas as diferenças (novos, alterados e removidos); fatias
              iguais são preservadas.
            </div>
          )}

          {matrizResult && (
            <div className="rounded-md border border-success/40 bg-success/10 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" />
                Lançamentos completos a partir da Matriz.
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <DiffPill label="Novos" valor={matrizResult.novos} tone="add" />
                <DiffPill label="Alterados" valor={matrizResult.alterados} tone="edit" />
                <DiffPill label="Removidos" valor={matrizResult.removidos} tone="del" />
                <DiffPill
                  label="Inalterados (preservados)"
                  valor={matrizResult.inalterados}
                  tone="keep"
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Total no arquivo: {matrizResult.total_rateios.toLocaleString("pt-BR")} fatias ·{" "}
                {matrizResult.titulos_distintos.toLocaleString("pt-BR")} títulos distintos ·{" "}
                {matrizResult.snapshots_reprocessados.toLocaleString("pt-BR")} snapshot(s)
                reprocessado(s).
              </div>
              <div className="mt-2 flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/financeiro/dividas">Abrir Fluxo de Dívidas</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/financeiro/lancamentos">Abrir visão geral</Link>
                </Button>
              </div>
            </div>
          )}

          {matrizError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Falha ao sincronizar matriz
              </div>
              <p className="mt-1 text-xs text-muted-foreground break-words">{matrizError}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DiffPill({
  label,
  valor,
  tone,
}: {
  label: string;
  valor: number;
  tone: "add" | "edit" | "del" | "keep";
}) {
  const toneClass =
    tone === "add"
      ? "border-success/40 bg-success/15 text-success "
      : tone === "edit"
        ? "border-warning/40 bg-warning/15 text-warning "
        : tone === "del"
          ? "border-destructive/30 bg-destructive/15 text-destructive "
          : "border-border bg-muted text-muted-foreground";
  return (
    <div className={`rounded-md border px-2 py-1.5 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-base font-semibold leading-tight">{valor.toLocaleString("pt-BR")}</div>
    </div>
  );
}

function CadenciaCard() {
  const { cadencia, setCadencia } = useImportCadencia();
  const info = useTotvsImportStatus(true);

  const statusColor =
    info.status === "atrasada"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : info.status === "vence_hoje"
        ? "border-warning/40 bg-warning/10 text-warning "
        : info.status === "em_dia"
          ? "border-success/40 bg-success/10 text-success "
          : "border-border bg-muted/40 text-muted-foreground";

  const statusIcon =
    info.status === "atrasada" || info.status === "vence_hoje" ? (
      <AlertCircle className="h-4 w-4" />
    ) : (
      <Clock className="h-4 w-4" />
    );

  const statusMsg = (() => {
    if (info.status === "sem_snapshot") return "Nenhuma importação registrada ainda.";
    if (info.status === "atrasada")
      return `Importação atrasada há ${info.atrasoDias} dia(s) em relação à cadência esperada.`;
    if (info.status === "vence_hoje") return "Importação prevista para hoje.";
    return `Próxima importação prevista em ${info.diasParaProxima} dia(s).`;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Cadência de importação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-[240px_1fr] gap-3 items-end">
          <div className="space-y-1.5">
            <Label>Cadência esperada</Label>
            <Select value={cadencia} onValueChange={(v) => setCadencia(v as ImportCadencia)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">{CADENCIA_LABEL.semanal}</SelectItem>
                <SelectItem value="quinzenal">{CADENCIA_LABEL.quinzenal}</SelectItem>
                <SelectItem value="mensal">{CADENCIA_LABEL.mensal}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Usada para alertar quando a importação está atrasada. Preferência salva por
              dispositivo.
            </p>
          </div>
          <div
            className={`rounded-md border px-3 py-2 text-sm flex items-start gap-2 ${statusColor}`}
          >
            {statusIcon}
            <div className="flex-1 min-w-0">
              <p className="font-medium">{statusMsg}</p>
              <p className="text-[11px] opacity-90">
                {info.ultimaImportacao
                  ? `Última importação: ${fmtData(info.ultimaImportacao)}`
                  : "Importe a Matriz para iniciar o acompanhamento."}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ImportarTotvs;
