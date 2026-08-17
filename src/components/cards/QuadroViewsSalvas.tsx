/**
 * QuadroViewsSalvas — REF.5.
 * Popover para carregar/salvar/excluir combinações de filtros do Quadro
 * por setor. Filtros vivem no JSONB `card_views_salvas.filtros` e são
 * aplicados via callback (que costuma escrever na URL no chamador).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cardViewsSalvasRepo } from "@/lib/repositories/cardsExtra";
import { useAuth } from "@/contexts/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bookmark, Plus, Trash2 } from "lucide-react";

export type FiltrosView = Record<string, string | boolean | null>;

interface Props {
  meusSetores: string[];
  isGM: boolean;
  filtrosAtuais: FiltrosView;
  onAplicar: (filtros: FiltrosView) => void;
}

interface ViewSalva {
  id: string;
  nome: string;
  setor: string;
  filtros: FiltrosView;
}

export default function QuadroViewsSalvas({ meusSetores, isGM, filtrosAtuais, onAplicar }: Props) {
  const { currentPlayer } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [setorAtivo, setSetorAtivo] = useState<string>(meusSetores[0] ?? "");
  const [novoNome, setNovoNome] = useState("");
  const [viewParaExcluir, setViewParaExcluir] = useState<ViewSalva | null>(null);

  const { data: views = [] } = useQuery({
    enabled: open,
    queryKey: ["card-views-salvas"],
    queryFn: () => cardViewsSalvasRepo.listOrdenadas() as Promise<ViewSalva[]>,
  });

  const setoresDisponiveis = isGM
    ? Array.from(new Set([...meusSetores, ...views.map((v) => v.setor)])).sort()
    : meusSetores;

  const viewsDoSetor = views.filter((v) => !setorAtivo || v.setor === setorAtivo);

  const salvar = async () => {
    const nome = novoNome.trim();
    if (!nome || !setorAtivo) {
      toast.error("Informe nome e setor");
      return;
    }
    const { error } = await cardViewsSalvasRepo.create({
      nome,
      setor: setorAtivo,
      filtros: filtrosAtuais,
      created_by: currentPlayer?.id ?? null,
    });
    if (error) return toast.error("Falha ao salvar view", { description: error.message });
    setNovoNome("");
    toast.success(`View "${nome}" salva em ${setorAtivo}`);
    qc.invalidateQueries({ queryKey: ["card-views-salvas"] });
  };

  const excluir = async (v: ViewSalva) => {
    const { error } = await cardViewsSalvasRepo.remove(v.id);
    if (error) return toast.error("Falha ao excluir", { description: error.message });
    toast.success("View excluída");
    qc.invalidateQueries({ queryKey: ["card-views-salvas"] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" title="Views salvas">
          <Bookmark className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Views</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 space-y-3">
        <div>
          <div className="text-xs font-semibold mb-1">Setor</div>
          <Select value={setorAtivo} onValueChange={setSetorAtivo}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione um setor" />
            </SelectTrigger>
            <SelectContent>
              {setoresDisponiveis.length === 0 && (
                <SelectItem value="__none" disabled>
                  Você não tem setor
                </SelectItem>
              )}
              {setoresDisponiveis.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="text-xs font-semibold mb-1">Views salvas</div>
          <div className="flex flex-col gap-1 max-h-48 overflow-auto">
            {viewsDoSetor.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">Nenhuma view neste setor.</p>
            )}
            {viewsDoSetor.map((v) => (
              <div key={v.id} className="flex items-center gap-1 group">
                <button
                  type="button"
                  onClick={() => {
                    onAplicar(v.filtros);
                    setOpen(false);
                  }}
                  className="flex-1 text-left text-xs px-2 py-1.5 rounded hover:bg-accent truncate"
                  title={v.nome}
                >
                  {v.nome}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir view"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={() => setViewParaExcluir(v)}
                  title="Excluir view"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-2">
          <div className="text-xs font-semibold mb-1">Salvar filtros atuais</div>
          <div className="flex items-center gap-1">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
              placeholder="Nome da view…"
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={salvar} disabled={!novoNome.trim() || !setorAtivo}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Salva busca, setor, responsável, etiqueta, obra, prazo, arquivados e modo de
            visualização.
          </p>
        </div>
      </PopoverContent>
      <AlertDialog open={!!viewParaExcluir} onOpenChange={(o) => !o && setViewParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir view</AlertDialogTitle>
            <AlertDialogDescription>
              {viewParaExcluir && (
                <>
                  Excluir a view <strong>{viewParaExcluir.nome}</strong>? Esta ação não pode ser
                  desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const v = viewParaExcluir;
                setViewParaExcluir(null);
                if (v) await excluir(v);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Popover>
  );
}
