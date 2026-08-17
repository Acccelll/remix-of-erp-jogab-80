import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useUpsertRdoFromChecklist } from "@/hooks/obras/useRdo";
import { importValidationRunsRepo } from "@/lib/repositories/obraDetalhe";
import { useObras } from "@/hooks/obras/useObras";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FeatureGate } from "@/components/common/FeatureGate";
import { OnboardingHint } from "@/components/onboarding/OnboardingHint";
import {
  parseChecklistXlsx,
  type ParsedChecklist,
  type ChecklistRdoRow,
} from "@/lib/checklist/parseChecklist";

type Obra = { id: string; nome: string; codigo: string | null };

interface ImportOutcome {
  ok: number;
  fail: number;
  fails: Array<{ rowIndex: number; motivo: string }>;
}

function resolveObraId(row: ChecklistRdoRow, obras: Obra[], forced: string): string | null {
  if (forced && forced !== "auto") return forced;
  const codigo = row.unidadeCodigo;
  if (codigo) {
    const norm = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "");
    const alvo = norm(codigo);
    // match por código exato, sufixo numérico, ou número final do nome ("214 - ...")
    const byCod = obras.find((o) => {
      const c = norm(o.codigo ?? "");
      if (c && (c === alvo || c.endsWith(alvo))) return true;
      const m = (o.nome ?? "").match(/(\d+)/);
      return m ? norm(m[1]) === alvo : false;
    });
    if (byCod) return byCod.id;
  }
  const nome = (row.unidadeNome ?? row.unidade ?? "").toLowerCase();
  if (!nome) return null;
  const byNome = obras.find((o) => o.nome.toLowerCase().includes(nome));
  return byNome?.id ?? null;
}

export default function ChecklistImport() {
  const [parsed, setParsed] = useState<ParsedChecklist | null>(null);
  const [fileName, setFileName] = useState("");
  const [forcedObra, setForcedObra] = useState("auto");
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const upsertRdoMut = useUpsertRdoFromChecklist();


  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () =>
      (obrasQuery.data ?? []).map((o) => ({
        id: o.id,
        nome: o.nome,
        codigo: o.codigo ?? null,
      })),
    [obrasQuery.data],
  );

  const preview = useMemo(() => parsed?.rows.slice(0, 5) ?? [], [parsed]);

  async function handleFile(file: File) {
    setFileName(file.name);
    setOutcome(null);
    const buf = await file.arrayBuffer();
    try {
      const r = parseChecklistXlsx(buf);
      setParsed(r);
      if (r.errors.length) {
        toast.warning(`${r.errors.length} linha(s) com erro no parse`);
      } else {
        toast.success(`${r.totalLinhas} relatório(s) detectado(s)`);
      }
    } catch (e) {
      toast.error("Falha ao ler XLSX: " + (e as Error).message);
    }
  }

  const importar = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error("Nada para importar");
      const fails: ImportOutcome["fails"] = [];
      let ok = 0;
      for (const row of parsed.rows) {
        const obraId = resolveObraId(row, obras, forcedObra);
        if (!obraId) {
          fails.push({
            rowIndex: row.rowIndex,
            motivo: `Obra não encontrada (Unidade: ${row.unidade})`,
          });
          continue;
        }
        try {
          const res = (await upsertRdoMut.mutateAsync({
            p_obra_id: obraId,
            p_data: row.data,
            p_checklist_codigo: row.codigo,
            p_clima_manha: row.climaManha ?? "",
            p_clima_tarde: row.climaTarde ?? "",
            p_clima_noite: row.climaNoite ?? "",
            p_trabalhavel_manha: row.trabalhavelManha,
            p_trabalhavel_tarde: row.trabalhavelTarde,
            p_trabalhavel_noite: row.trabalhavelNoite,
            p_observacoes: row.observacoes,
            p_atividades: row.atividades as never,
            p_efetivo: row.efetivo as never,
            p_ocorrencias: row.ocorrencias as never,
          })) as { error?: { message?: string } | null };
          if (res?.error) {
            fails.push({ rowIndex: row.rowIndex, motivo: res.error.message ?? "erro" });
          } else {
            ok++;
          }
        } catch (e) {
          fails.push({ rowIndex: row.rowIndex, motivo: (e as Error).message });
        }


      }
      const result: ImportOutcome = { ok, fail: fails.length, fails };
      // Log da execução em import_validation_runs
      try {
        await importValidationRunsRepo.insert({
          sistema: "checklist" as never,
          obra_id: forcedObra !== "auto" ? forcedObra : null,
          contagem_origem: parsed.rows.length,
          contagem_destino: ok,
          divergencias: fails as never,
          amostra: parsed.rows.slice(0, 10) as never,
          status: fails.length === 0 ? "aprovado" : "pendente",
          observacoes: `Arquivo: ${fileName}`,
        });
      } catch {
        /* log opcional */
      }
      return result;
    },
    onSuccess: (r) => {
      setOutcome(r);
      if (r.fail === 0) toast.success(`${r.ok} RDOs importados`);
      else toast.warning(`${r.ok} ok / ${r.fail} com erro`);
    },
    onError: (e) => toast.error("Erro: " + (e as Error).message),
  });

  return (
    <FeatureGate
      flag="legacy.checklist_import"
      fallback={
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Importação do Checklist Fácil desligada para esta obra (cutover concluído).
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-4">
        <OnboardingHint storageKey="checklist-import-intro" title="Importação do Checklist Fácil">
          Exporte o relatório diário do Checklist Fácil em XLSX e suba aqui. Cada linha vira um RDO
          nativo (mesma tabela do RDO digital), com clima, atividades, efetivo e ocorrências.
          Reimportar sobrescreve o RDO do dia.
        </OnboardingHint>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4" /> Arquivo do Checklist Fácil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {fileName && <div className="text-xs text-muted-foreground">{fileName}</div>}

            <div className="grid gap-2 sm:max-w-sm">
              <Label>Obra (opcional)</Label>
              <Select value={forcedObra} onValueChange={setForcedObra}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detectar pela coluna "Unidade"</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.codigo ? `${o.codigo} — ` : ""}
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {parsed && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Pré-visualização ({parsed.totalLinhas} relatórios)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {parsed.errors.length > 0 && (
                <div className="text-xs text-warning flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {parsed.errors.length} linha(s) ignoradas
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="text-left py-1 pr-2">Data</th>
                      <th className="text-left pr-2">Obra</th>
                      <th className="text-left pr-2">Atividades</th>
                      <th className="text-left pr-2">Efetivo</th>
                      <th className="text-left pr-2">Ocorrências</th>
                      <th className="text-left pr-2">Clima M/T/N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => {
                      const obraId = resolveObraId(r, obras, forcedObra);
                      const obraNome = obras.find((o) => o.id === obraId)?.nome ?? "—";
                      return (
                        <tr key={r.rowIndex} className="border-b">
                          <td className="py-1 pr-2">{r.data}</td>
                          <td className="pr-2">
                            {obraId ? (
                              obraNome
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                {r.unidade}
                              </Badge>
                            )}
                          </td>
                          <td className="pr-2">{r.atividades.length}</td>
                          <td className="pr-2">{r.efetivo.length}</td>
                          <td className="pr-2">{r.ocorrencias.length}</td>
                          <td
                            className="pr-2 max-w-[14rem] truncate"
                            title={`${r.climaManha} / ${r.climaTarde} / ${r.climaNoite}`}
                          >
                            {[r.climaManha, r.climaTarde, r.climaNoite]
                              .map((c) => (c ? c.split(" ")[0] : "—"))
                              .join(" / ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Button
                onClick={() => importar.mutate()}
                disabled={importar.isPending || !parsed.rows.length}
              >
                {importar.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" /> Importar {parsed.rows.length} RDOs
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {outcome && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {outcome.fail === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                )}
                Resultado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <Badge variant="secondary">{outcome.ok} importado(s)</Badge>{" "}
                {outcome.fail > 0 && <Badge variant="destructive">{outcome.fail} com erro</Badge>}
              </div>
              {outcome.fails.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-1">
                  {outcome.fails.map((f) => (
                    <li key={f.rowIndex}>
                      Linha {f.rowIndex}: {f.motivo}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </FeatureGate>
  );
}
