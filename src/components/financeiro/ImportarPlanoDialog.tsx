/**
 * Dialog para importar Naturezas Orçamentárias ou Centros de Custo a partir de
 * uma planilha .xlsx no formato "Plano de Contas" (colunas: Código, Descrição).
 *
 * Detecta automaticamente a aba correta pelo nome ("Natureza Orcamentaria" /
 * "Centro de Custo"); se só houver uma aba, usa-a diretamente. Hierarquia é
 * derivada pelo número de segmentos separados por ponto.
 */
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type PlanoKind = "natureza" | "centro";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: PlanoKind;
  existingCodigos?: Set<string>;
}

interface ParsedRow {
  codigo: string;
  descricao: string;
  nivel: number;
  cod_pai: string | null;
  exists: boolean;
}

const SHARED_OWNER_ID = "00000000-0000-0000-0000-000000000000";

const SHEET_HINTS: Record<PlanoKind, string[]> = {
  natureza: ["natureza", "natureza orcamentaria", "naturezas"],
  centro: ["centro de custo", "centros de custo", "centro custo"],
};

function norm(s: string) {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pickSheet(wb: XLSX.WorkBook, kind: PlanoKind): string | null {
  const hints = SHEET_HINTS[kind];
  const names = wb.SheetNames;
  for (const n of names) {
    const nn = norm(n);
    if (hints.some((h) => nn.includes(h))) return n;
  }
  if (names.length === 1) return names[0];
  return null;
}

function parseSheet(sheet: XLSX.WorkSheet, existing: Set<string>): ParsedRow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const out: ParsedRow[] = [];
  for (const r of rows) {
    // aceita "Código"/"Codigo"/"code" e "Descrição"/"Descricao"/"descricao"
    let codigo = "";
    let descricao = "";
    for (const [k, v] of Object.entries(r)) {
      const kn = norm(k);
      if (!codigo && (kn === "codigo" || kn === "code" || kn.startsWith("cod"))) {
        codigo = String(v ?? "").trim();
      } else if (
        !descricao &&
        (kn === "descricao" || kn === "description" || kn.startsWith("desc"))
      ) {
        descricao = String(v ?? "").trim();
      }
    }
    if (!codigo) continue;
    const segs = codigo.split(".");
    const nivel = segs.length;
    const cod_pai = nivel > 1 ? segs.slice(0, -1).join(".") : null;
    out.push({
      codigo,
      descricao,
      nivel,
      cod_pai,
      exists: existing.has(codigo),
    });
  }
  // ordena por nível para satisfazer eventual FK
  out.sort((a, b) => a.nivel - b.nivel || a.codigo.localeCompare(b.codigo));
  return out;
}

export default function ImportarPlanoDialog({
  open,
  onOpenChange,
  kind,
  existingCodigos,
}: Props) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [sheetName, setSheetName] = useState<string>("");
  const [overwrite, setOverwrite] = useState(true);
  const [busy, setBusy] = useState(false);

  const existing = existingCodigos ?? new Set<string>();

  async function handleFile(f: File) {
    setFile(f);
    setRows([]);
    setSheetName("");
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sh = pickSheet(wb, kind);
      if (!sh) {
        toast.error(
          `Não achei a aba de ${kind === "natureza" ? "Naturezas" : "Centros de Custo"} no arquivo`,
        );
        return;
      }
      setSheetName(sh);
      const parsed = parseSheet(wb.Sheets[sh], existing);
      if (parsed.length === 0) {
        toast.error("Nenhuma linha válida encontrada (Código/Descrição)");
        return;
      }
      setRows(parsed);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler planilha");
    }
  }

  const stats = useMemo(() => {
    let novos = 0;
    let existentes = 0;
    for (const r of rows) {
      if (r.exists) existentes += 1;
      else novos += 1;
    }
    return { novos, existentes, total: rows.length };
  }, [rows]);

  async function importar() {
    if (rows.length === 0) return;
    setBusy(true);
    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;
    try {
      if (kind === "natureza") {
        const descMap = new Map<string, string>();
        for (const r of rows) descMap.set(r.codigo, r.descricao);
        const alvos = overwrite ? rows : rows.filter((r) => !r.exists);
        for (const r of rows) if (r.exists && !overwrite) ignorados++;
        // upsert em lotes por nível
        const grupos = new Map<number, ParsedRow[]>();
        for (const r of alvos) {
          const arr = grupos.get(r.nivel) ?? [];
          arr.push(r);
          grupos.set(r.nivel, arr);
        }
        const niveis = Array.from(grupos.keys()).sort((a, b) => a - b);
        for (const n of niveis) {
          const batch = grupos.get(n)!.map((r) => {
            const grupoDesc = descMap.get(r.codigo.split(".")[0]) ?? r.descricao;
            const subDesc =
              r.nivel >= 2
                ? (descMap.get(r.codigo.split(".").slice(0, 2).join(".")) ?? null)
                : null;
            return {
              cod_natureza: r.codigo,
              descricao: r.descricao,
              nivel: r.nivel,
              cod_pai: r.cod_pai,
              grupo: grupoDesc,
              subgrupo: subDesc,
              ativo: true,
            };
          });
          const { error } = await supabase
            .from("plano_contas")
            .upsert(batch, { onConflict: "cod_natureza" });
          if (error) throw error;
          for (const r of grupos.get(n)!) {
            if (r.exists) atualizados += 1;
            else inseridos += 1;
          }
        }
      } else {
        // centros: define categoria como descricao do ancestor de nível 1;
        // vincula à obra quando o código bate com obras.centro_custo_totvs.
        const descMap = new Map<string, string>();
        for (const r of rows) descMap.set(r.codigo, r.descricao);
        // carrega mapa código TOTVS -> obra_id
        const { data: obrasVinc } = await supabase
          .from("obras")
          .select("id, centro_custo_totvs")
          .not("centro_custo_totvs", "is", null);
        const obraByCod = new Map<string, string>();
        for (const o of obrasVinc ?? []) {
          const k = String((o as any).centro_custo_totvs ?? "").trim();
          if (k) obraByCod.set(k, (o as any).id);
        }
        const alvos = overwrite ? rows : rows.filter((r) => !r.exists);
        for (const r of rows) if (r.exists && !overwrite) ignorados++;
        const batch = alvos.map((r) => {
          const nivel1 = r.codigo.split(".")[0];
          const categoria = descMap.get(nivel1) ?? r.descricao;
          const obraId = obraByCod.get(r.codigo) ?? null;
          return {
            owner_id: SHARED_OWNER_ID,
            codigo: r.codigo,
            descricao: r.descricao,
            tipo: (obraId ? "obra" : "indireto") as "obra" | "indireto",
            obra_id: obraId,
            categoria: obraId ? null : categoria,
            ativo: true,
          };
        });
        // upsert em pedaços de 500 para não exceder payload
        for (let i = 0; i < batch.length; i += 500) {
          const slice = batch.slice(i, i + 500);
          const { error } = await supabase
            .from("centros_custo_totvs")
            .upsert(slice, { onConflict: "owner_id,codigo" });
          if (error) throw error;
        }
        for (const r of alvos) {
          if (r.exists) atualizados += 1;
          else inseridos += 1;
        }
      }
      toast.success(
        `Importação concluída — ${inseridos} inseridos, ${atualizados} atualizados${
          ignorados ? `, ${ignorados} ignorados` : ""
        }`,
      );
      qc.invalidateQueries();
      onOpenChange(false);
      setFile(null);
      setRows([]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar");
    } finally {
      setBusy(false);
    }
  }

  const label = kind === "natureza" ? "Naturezas orçamentárias" : "Centros de Custo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar {label}
          </DialogTitle>
          <DialogDescription>
            Planilha .xlsx com colunas <strong>Código</strong> e <strong>Descrição</strong>. A
            hierarquia é derivada pelos pontos no código (ex.: <code>1.01.001</code> = nível 3).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="plano-file">Arquivo</Label>
            <Input
              id="plano-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {file && sheetName && (
              <p className="text-xs text-muted-foreground">
                Aba detectada: <span className="font-mono">{sheetName}</span>
              </p>
            )}
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <Badge variant="secondary">{stats.total} linhas</Badge>
                <Badge variant="outline" className="border-primary/40">
                  {stats.novos} novos
                </Badge>
                {stats.existentes > 0 && (
                  <Badge variant="outline" className="border-warning/40">
                    {stats.existentes} já existem
                  </Badge>
                )}
              </div>

              {stats.existentes > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="overwrite"
                    checked={overwrite}
                    onCheckedChange={(v) => setOverwrite(!!v)}
                  />
                  <Label htmlFor="overwrite" className="text-sm cursor-pointer">
                    Sobrescrever descrição dos códigos já existentes
                  </Label>
                </div>
              )}

              <div className="max-h-[300px] overflow-auto border rounded">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-32">Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-20 text-right">Nível</TableHead>
                      <TableHead className="w-24 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 200).map((r) => (
                      <TableRow key={r.codigo}>
                        <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                        <TableCell>{r.descricao}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-[10px]">
                            N{r.nivel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.exists ? (
                            <Badge variant="outline" className="text-[10px]">
                              existe
                            </Badge>
                          ) : (
                            <Badge className="text-[10px]">novo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length > 200 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-xs text-muted-foreground"
                        >
                          … +{rows.length - 200} linhas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={importar} disabled={busy || rows.length === 0}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" /> Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
