import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import {
  parseRelatorioCsv,
  inferPeriodoDoNome,
  type ParsedPontoRow,
  type ParseResult,
} from "@/lib/ponto/parseRelatorioCsv";
import { formatMinutes } from "@/lib/ponto/formatMinutes";
import { useImportarPonto } from "@/hooks/dp/usePonto";
import { useAuth } from "@/contexts/auth/useAuth";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { useNavigate } from "react-router-dom";
import {
  ImportValidationReport,
  type ImportValidationData,
} from "@/components/migracao/ImportValidationReport";
import { hojeBrasilia, primeiroDiaMesBrasilia } from "@/lib/core/date";

function isValidIsoDate(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return (
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
  );
}

function rowsComNomeDoCadastro(
  rows: ParsedPontoRow[],
  colaboradores: Array<{ nome?: string; cpf?: string }>,
) {
  const byCpf = new Map<string, string>();
  for (const c of colaboradores) {
    const cpf = c.cpf ? String(c.cpf).replace(/\D/g, "") : "";
    if (cpf && c.nome) byCpf.set(cpf, c.nome);
  }
  return rows.map((row) => {
    const nome = row.cpf ? byCpf.get(row.cpf) : undefined;
    return nome ? { ...row, nome } : row;
  });
}

export default function PontoImportar() {
  const { currentPlayer } = useAuth();
  const { colaboradores } = useColaboradoresContext();
  const navigate = useNavigate();
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDiaMesBrasilia());
  const [periodoFim, setPeriodoFim] = useState(hojeBrasilia());
  const [validation, setValidation] = useState<ImportValidationData | null>(null);
  const importarPontoMut = useImportarPonto();

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let text: string;
    const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    if (hasBom) {
      text = new TextDecoder("utf-8").decode(buf);
    } else {
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        text = new TextDecoder("iso-8859-1").decode(buf);
      }
    }
    try {
      const r = parseRelatorioCsv(text);
      setResult(r);
      // se o CSV tem datas, usa; senão tenta inferir do nome do arquivo
      if (r.periodoInicio && r.periodoFim) {
        setPeriodoInicio(r.periodoInicio);
        setPeriodoFim(r.periodoFim);
      } else {
        const inf = inferPeriodoDoNome(file.name);
        if (inf) {
          setPeriodoInicio(inf.inicio);
          setPeriodoFim(inf.fim);
        }
      }
    } catch (e: any) {
      toast.error("Erro ao processar CSV: " + e.message);
    }
  }, []);

  const handleConfirm = async () => {
    if (!result || !result.rows.length) return;
    if (!isValidIsoDate(periodoInicio) || !isValidIsoDate(periodoFim)) {
      toast.error("Informe um período válido no formato AAAA-MM-DD.");
      return;
    }
    try {
      const rows = rowsComNomeDoCadastro(result.rows, colaboradores as any);
      const { colabMap } = await importarPontoMut.mutateAsync({
        arquivoNome: fileName,
        rows,
        periodoInicio,
        periodoFim,
        importadoPor: currentPlayer?.login ?? null,
        colaboradoresCtx: colaboradores as any,
      });
      const matched = rows.filter(
        (r) => r.cpf && r.nome !== result.rows.find((orig) => orig.cpf === r.cpf)?.nome,
      ).length;
      toast.success(
        `Importação concluída: ${rows.length} registros (${matched} nomes puxados pelo CPF).`,
      );
      const naoVinculados = rows.filter((r) => !r.cpf || !colabMap.get(r.cpf)).length;
      setValidation({
        sistema: "ponto",
        contagemOrigem: result.rows.length,
        contagemDestino: rows.length,
        divergencias:
          naoVinculados > 0
            ? [
                {
                  campo: "colaborador",
                  origem: rows.length,
                  destino: rows.length - naoVinculados,
                  nota: `${naoVinculados} sem CPF/colaborador no cadastro`,
                },
              ]
            : [],
        amostra: rows.slice(0, 10),
      });
    } catch (e: any) {
      toast.error("Falha ao importar: " + (e?.message || JSON.stringify(e)));
    }
  };

  const aggregated = result && !result.periodoInicio; // relatório sem coluna de data

  // Lookup por CPF (coluna E) para puxar nome canônico do cadastro
  const colabByCpf = new Map<string, { id: string; nome: string; matricula?: string }>();
  for (const c of colaboradores as any[]) {
    if (c.cpf) colabByCpf.set(String(c.cpf).replace(/\D/g, ""), c);
  }
  const matchedCount = result?.rows.filter((r) => r.cpf && colabByCpf.has(r.cpf)).length ?? 0;
  const saving = importarPontoMut.isPending;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Importar Ponto</h1>
        <p className="text-sm text-muted-foreground">
          Modelo suportado: relatório agregado por colaborador (CS Rodrigues / sistema de ponto) —
          colunas Diurnas/Noturnas Normais, Horas Previstas, Dia Falta, Falta e Atraso, Extra
          0%/60%, etc.
        </p>
      </header>

      {validation && (
        <ImportValidationReport
          data={validation}
          onApproved={() => navigate("/dp/ponto/analise")}
        />
      )}

      <Card className="p-6">
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-10 cursor-pointer hover:bg-accent/30 transition">
          <Upload className="w-10 h-10 text-muted-foreground" />
          <span className="font-medium">Selecione ou arraste o arquivo CSV</span>
          <span className="text-xs text-muted-foreground">
            Detecção automática de separador (; ou ,) e encoding
          </span>
          <Input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
        {fileName && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <FileCheck2 className="w-4 h-4 text-success" />
            <span>{fileName}</span>
            {result?.empresa && <span className="text-muted-foreground">· {result.empresa}</span>}
          </div>
        )}
      </Card>

      {result && (
        <>
          <Card className="p-4">
            <h3 className="font-semibold mb-3">
              Período do relatório{" "}
              {aggregated && (
                <span className="text-xs text-warning">
                  (informe — CSV agregado, sem data por linha)
                </span>
              )}
            </h3>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-xs block mb-1">Data inicial</label>
                <DatePickerField
                  value={isValidIsoDate(periodoInicio) ? periodoInicio : ""}
                  onChange={(v) => setPeriodoInicio(v)}
                  className="w-44"
                />
              </div>
              <div>
                <label className="text-xs block mb-1">Data final</label>
                <DatePickerField
                  value={isValidIsoDate(periodoFim) ? periodoFim : ""}
                  onChange={(v) => setPeriodoFim(v)}
                  className="w-44"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPeriodoInicio(primeiroDiaMesBrasilia());
                  setPeriodoFim(hojeBrasilia());
                }}
              >
                Mês atual
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Linhas válidas</div>
              <div className="text-2xl font-bold">{result.rows.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Colaboradores</div>
              <div className="text-2xl font-bold">{result.colaboradoresUnicos}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Vinculados (CPF)</div>
              <div className="text-2xl font-bold text-success">
                {matchedCount}
                <span className="text-base text-muted-foreground">/{result.rows.length}</span>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Ignoradas</div>
              <div className="text-2xl font-bold">{result.ignoradas}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Total HE 60%</div>
              <div className="text-2xl font-bold tabular-nums">
                {formatMinutes(result.rows.reduce((a, r) => a + r.horas_extra_60_min, 0))}
              </div>
            </Card>
          </div>

          <Card className="p-4 overflow-auto">
            <h3 className="font-semibold mb-3">Pré-visualização (primeiras 30 linhas)</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CPF (col. E)</TableHead>
                  <TableHead>Colaborador (cadastro)</TableHead>
                  <TableHead>Nome no CSV</TableHead>
                  <TableHead>Depto</TableHead>
                  <TableHead className="text-right">Prev.</TableHead>
                  <TableHead className="text-right">Trab.</TableHead>
                  <TableHead className="text-right">HE 60</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.slice(0, 30).map((r, i) => {
                  const match = r.cpf ? colabByCpf.get(r.cpf) : undefined;
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-xs tabular-nums">{r.cpf || "—"}</TableCell>
                      <TableCell className="font-medium">
                        {match ? (
                          <span>
                            {match.matricula && (
                              <span className="text-xs text-muted-foreground mr-2">
                                {match.matricula}
                              </span>
                            )}
                            {match.nome}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.nome}</TableCell>
                      <TableCell className="text-xs">{r.departamento}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMinutes(r.horas_previstas_min)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMinutes(r.horas_trabalhadas_min)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMinutes(r.horas_extra_60_min)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {match ? (
                          <span className="text-success">Vinculado</span>
                        ) : (
                          <span className="text-warning">Não cadastrado</span>
                        )}
                        {r.falta && <span className="text-destructive ml-2">Falta</span>}
                        {r.atestado && <span className="text-primary ml-2">Atestado</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setFileName("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={saving || !result.rows.length}>
              {saving ? "Importando..." : `Confirmar importação (${result.rows.length} registros)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
