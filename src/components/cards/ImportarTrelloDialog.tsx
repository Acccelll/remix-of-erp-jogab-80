// @ts-nocheck
import { useObras } from "@/hooks/obras/useObras";
/**
 * Diálogo de importação de board do Trello → board atual.
 * Mapeia listas do Trello em listas do board (criar nova ou mesclar) e
 * importa cards com label/checklist/anexo/comentário/atividade/customField.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImportValidationReport } from "@/components/migracao/ImportValidationReport";
import { authRepo } from "@/lib/repositories/auth";
import { useAuth } from "@/contexts/auth/useAuth";
import { ensureCloudSession } from "@/lib/auth/ensureCloudSession";
import { uuidOrNull } from "@/lib/core/uuid";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { ImportDialogShell } from "@/components/import/ImportDialogShell";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  importarBoardTrello,
  type TrelloBoardJson,
  type ImportarTrelloResultado,
  type MapaListas,
} from "@/lib/cards/trello-import";
import { parseTrelloCsv } from "@/lib/trello/parseTrelloCsv";
import { withDeadline, isDeadlineExceeded } from "@/lib/core/http/withDeadline";
import { Upload, FileJson, Loader2 } from "lucide-react";


interface Props {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NOVA = "__nova";

export default function ImportarTrelloDialog({ boardId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { currentPlayer } = useAuth();

  const [rawJson, setRawJson] = useState("");
  const [board, setBoard] = useState<TrelloBoardJson | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);

  const [mapaListas, setMapaListas] = useState<MapaListas>({});
  const [obraId, setObraId] = useState<string>("__none");
  const [incluirArquivados, setIncluirArquivados] = useState(true);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ImportarTrelloResultado | null>(null);

  // Board atual (para pré-preencher obra e setor)
  const { data: boardAtual } = useQuery({
    enabled: open && !!boardId,
    queryKey: ["board-cfg-import", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("id, nome, setor, obra_id")
        .eq("id", boardId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (boardAtual?.obra_id) setObraId(boardAtual.obra_id);
  }, [boardAtual?.obra_id]);

  // Listas existentes do board para o select de mesclagem
  const { data: listasBoard = [] } = useQuery({
    enabled: open && !!boardId,
    queryKey: ["board-listas-import", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_listas")
        .select("id, nome, posicao, origem_externa, origem_id")
        .eq("board_id", boardId)
        .eq("arquivada", false)
        .order("posicao");
      if (error) throw error;
      return data ?? [];
    },
  });

  const obrasQuery = useObras({ enabled: open });
  const obras = useMemo(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );

  const onFile = async (file: File) => {
    try {
      const txt = await file.text();
      setRawJson(txt);
      if (file.name.toLowerCase().endsWith(".csv")) parseCsv(txt);
      else parseJson(txt);
    } catch (err) {
      setParseErr(`Falha ao ler arquivo: ${(err as Error).message}`);
    }
  };

  const aplicarHeuristicaMesclagem = (j: TrelloBoardJson) => {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    const porOrigem = new Map(
      listasBoard
        .filter((l: any) => l.origem_externa === "trello" && l.origem_id)
        .map((l: any) => [l.origem_id, l.id]),
    );
    const idx = new Map<string, string>();
    for (const l of listasBoard as any[]) {
      const key = norm(l.nome);
      // Em boards que já sofreram reimportações antigas pode haver listas com
      // nomes duplicados; a última geralmente é a importação Trello efetiva.
      if (key) idx.set(key, l.id);
    }
    const m: MapaListas = {};
    for (const l of j.lists) {
      const hit = porOrigem.get(l.id) ?? idx.get(norm(l.name ?? ""));
      m[l.id] = hit ?? null; // null = criar nova
    }
    setMapaListas(m);
  };

  const parseJson = (txt: string) => {
    setParseErr(null);
    setResultado(null);
    try {
      const j = JSON.parse(txt) as TrelloBoardJson;
      if (!Array.isArray(j.lists) || !Array.isArray(j.cards)) {
        setParseErr("JSON não parece ser uma exportação do Trello (faltam 'lists' ou 'cards').");
        setBoard(null);
        return;
      }
      setBoard(j);
      aplicarHeuristicaMesclagem(j);
    } catch (err) {
      setParseErr(`JSON inválido: ${(err as Error).message}`);
      setBoard(null);
    }
  };

  const parseCsv = (txt: string) => {
    setParseErr(null);
    setResultado(null);
    try {
      const j = parseTrelloCsv(txt);
      if (j.cards.length === 0) {
        setParseErr("CSV sem cards reconhecidos.");
        setBoard(null);
        return;
      }
      setBoard(j);
      aplicarHeuristicaMesclagem(j);
    } catch (err) {
      setParseErr(`CSV inválido: ${(err as Error).message}`);
      setBoard(null);
    }
  };

  // Re-aplica heurística se as listas do board carregarem após o parse.
  useEffect(() => {
    if (board && listasBoard.length > 0 && Object.keys(mapaListas).length === 0) {
      aplicarHeuristicaMesclagem(board);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listasBoard.length, board]);

  const totalCards = useMemo(() => board?.cards?.length ?? 0, [board]);
  const totalComentarios = useMemo(
    () =>
      (board?.actions ?? []).filter((a) => a.type === "commentCard" || a.type === "copyCommentCard")
        .length,
    [board],
  );
  const totalAnexos = useMemo(
    () => (board?.cards ?? []).reduce((s, c) => s + (c.attachments?.length ?? 0), 0),
    [board],
  );
  const listasOrdenadas = useMemo(
    () => [...(board?.lists ?? [])].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0)),
    [board],
  );

  const executar = async () => {
    if (!board) return;
    setImportando(true);
    setResultado(null);
    try {
      await ensureCloudSession(currentPlayer);
      const uid = uuidOrNull(await authRepo.getUserId());
      if (!uid) {
        toast.error("Sessão expirada. Entre novamente para importar.");
        setImportando(false);
        return;
      }
      const r = await withDeadline(
        importarBoardTrello({
          board,
          boardId,
          obraId: obraId === "__none" ? null : obraId,
          criadoPor: uid,
          mapaListas,
          incluirArquivados,
          setor: boardAtual?.setor ?? null,
        }),
        180_000,
        "trello.importarBoard",
      );
      setResultado(r);
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      qc.invalidateQueries({ queryKey: ["board-listas", boardId] });
      qc.invalidateQueries({ queryKey: ["board-items", boardId] });
      qc.invalidateQueries({ queryKey: ["board-cards", boardId] });
      qc.invalidateQueries({ queryKey: ["card-labels"] });
      const totalProcessados = r.cardsCriados + r.cardsSincronizados;
      if (r.erros.length === 0) {
        toast.success(`Importação concluída: ${totalProcessados} cards processados`);
      } else {
        toast.warning(`Importado com ${r.erros.length} aviso(s)`, {
          description: `${totalProcessados} cards · ${r.listasCriadas} listas novas`,
        });
      }
    } catch (err) {
      if (isDeadlineExceeded(err)) {
        toast.error("Importação excedeu o tempo limite (3 min)", {
          description: "Divida o board em lotes menores ou tente novamente.",
        });
      } else {
        toast.error("Falha na importação", { description: (err as Error).message });
      }
    } finally {
      setImportando(false);
    }
  };


  const resetar = () => {
    setRawJson("");
    setBoard(null);
    setParseErr(null);
    setMapaListas({});
    setResultado(null);
  };

  return (
    <ImportDialogShell
      open={open}
      onOpenChange={(o) => {
        if (!o) resetar();
        onOpenChange(o);
      }}
      size="max-w-3xl"
      title={
        <span className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          Importar board do Trello
        </span>
      }
      description="Cole o JSON do Trello (Menu do board → Mais → Imprimir e exportar → Exportar JSON) ou faça upload do arquivo. As listas, cards, etiquetas, checklists, comentários, anexos, membros, campos personalizados e histórico de atividades são importados para este quadro."
    >

        {!board && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".json,application/json,.csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                />
                <Button type="button" variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-1" /> Selecionar .json ou .csv
                  </span>
                </Button>
              </label>
              <span className="text-xs text-muted-foreground">
                JSON (recomendado, completo) · CSV (fallback simplificado)
              </span>
            </div>
            <Textarea
              placeholder='{"name":"...","lists":[...],"cards":[...], ...}'
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              className="font-mono text-xs h-40"
            />
            {rawJson.trim() && (
              <Button size="sm" variant="secondary" onClick={() => parseJson(rawJson)}>
                Analisar JSON
              </Button>
            )}
            {parseErr && <p className="text-sm text-destructive">{parseErr}</p>}
          </div>
        )}

        {board && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{board.name ?? "(board sem nome)"}</div>
              <div className="text-xs text-muted-foreground">
                {board.lists.length} listas · {totalCards} cards · {board.labels?.length ?? 0}{" "}
                etiquetas · {board.checklists?.length ?? 0} checklists · {totalComentarios}{" "}
                comentários · {totalAnexos} anexos · {board.members?.length ?? 0} membros ·{" "}
                {board.customFields?.length ?? 0} campos personalizados ·{" "}
                {(board.actions ?? []).length} ações
              </div>
            </div>

            <div className="space-y-1">
              <Label>Obra (opcional)</Label>
              <Select value={obraId} onValueChange={setObraId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem obra vinculada</SelectItem>
                  {obras.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Setor herdado do board: <strong>{boardAtual?.setor ?? "(nenhum)"}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Listas do Trello → Listas do board</Label>
              <div className="border rounded-md divide-y">
                {listasOrdenadas.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="flex-1 truncate">
                      {l.name}
                      {l.closed && (
                        <span className="ml-2 text-xs text-muted-foreground">(arquivada)</span>
                      )}
                    </div>
                    <Select
                      value={mapaListas[l.id] ?? NOVA}
                      onValueChange={(v) =>
                        setMapaListas((m) => ({ ...m, [l.id]: v === NOVA ? null : v }))
                      }
                    >
                      <SelectTrigger className="w-64 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NOVA}>↳ Criar nova lista</SelectItem>
                        {listasBoard.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            Mesclar em: {b.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir-arquivados"
                checked={incluirArquivados}
                onCheckedChange={(v) => setIncluirArquivados(!!v)}
              />
              <Label htmlFor="incluir-arquivados" className="text-sm font-normal">
                Importar cards arquivados do Trello (entram como arquivados aqui também)
              </Label>
            </div>

            {resultado && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <div className="font-medium">Resultado</div>
                <div>
                  • {resultado.listasCriadas} listas criadas · {resultado.listasMescladas} mescladas
                </div>
                <div>
                  • {resultado.cardsCriados} cards criados · {resultado.cardsSincronizados}{" "}
                  sincronizados
                </div>
                <div>• {resultado.labelsCriadas} etiquetas novas</div>
                <div>• {resultado.checklistItens} itens de checklist</div>
                <div>• {resultado.comentarios} comentários</div>
                <div>• {resultado.anexos} anexos (URLs do Trello)</div>
                <div>
                  • {resultado.membrosExternos} membros externos ·{" "}
                  {resultado.boardMembrosVinculados} vinculados ao board
                </div>
                <div>
                  • {resultado.customFieldsCriados} custom fields novos ·{" "}
                  {resultado.customFieldValores} valores aplicados
                </div>
                <div>• {resultado.atividadesRegistradas} atividades históricas</div>
                {resultado.erros.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-destructive">
                      {resultado.erros.length} aviso(s)
                    </summary>
                    <ul className="list-disc pl-5 text-xs mt-1">
                      {resultado.erros.slice(0, 30).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                      {resultado.erros.length > 30 && (
                        <li>... e mais {resultado.erros.length - 30}</li>
                      )}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {resultado && board && (
              <ImportValidationReport
                data={{
                  sistema: "trello",
                  obraId: obraId === "__none" ? null : obraId,
                  contagemOrigem: board.cards?.length ?? 0,
                  contagemDestino: resultado.cardsCriados + resultado.cardsSincronizados,
                  divergencias: resultado.erros.slice(0, 50).map((e) => ({
                    campo: "import",
                    origem: "—",
                    destino: "—",
                    nota: e,
                  })),
                  amostra: (board.cards ?? []).slice(0, 10),
                }}
              />
            )}
          </div>
        )}

        <DialogFooter>
          {board && !resultado && (
            <Button variant="outline" onClick={resetar} disabled={importando}>
              Trocar arquivo
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importando}>
            {resultado ? "Fechar" : "Cancelar"}
          </Button>
          {board && !resultado && (
            <Button onClick={executar} disabled={importando}>
              {importando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando…
                </>
              ) : (
                "Importar"
              )}
            </Button>
          )}
        </DialogFooter>
    </ImportDialogShell>
  );
}
