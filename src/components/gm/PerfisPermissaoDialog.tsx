// PRO-028 · slice-02 — UI de gestão dos perfis reutilizáveis de permissões.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/ui/confirm";
import { usePerfisPermissao } from "@/hooks/gm/usePerfisPermissao";
import {
  normalizarAcessos,
  PAGINAS_PERMISSAO,
  type PerfilPermissao,
} from "@/lib/players/perfisPermissao";
import type { NivelAcesso, PageKey } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const pageLabels: Record<PageKey, string> = {
  obras_div: "Obras",
  rh: "Gestão de RH",
  dp: "Depto. Pessoal",
  patrimonios: "Almoxarifado",
  frotas: "Frotas",
  admin: "Gerenciamento",
  financeiro: "Financeiro",
  contratos: "Administração",
  // ⚠️ `patrimonios` acima já é rotulado "Almoxarifado" nesta tela. O módulo
  // novo usa o rótulo da navegação para não haver dois "Almoxarifado" no Quadro.
  almoxarifado: "Suprimentos",
  crm: "CRM",
};

const nivelLabels: Record<NivelAcesso, string> = {
  nenhum: "Não Visualizar",
  visualizar: "Visualizar",
  editar: "Editar",
  compras: "Compras",
  financeiro: "Financeiro",
};

const financeiroNiveis: NivelAcesso[] = ["nenhum", "visualizar", "compras", "financeiro"];
const normalNiveis: NivelAcesso[] = ["nenhum", "visualizar", "editar"];

export function PerfisPermissaoDialog({ open, onOpenChange }: Props) {
  const { perfis, adicionar, atualizar, remover } = usePerfisPermissao();
  const [editando, setEditando] = useState<PerfilPermissao | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [acessos, setAcessos] = useState<Record<PageKey, NivelAcesso>>(() => normalizarAcessos({}));
  const [modo, setModo] = useState<"lista" | "form">("lista");

  const abrirNovo = () => {
    setEditando(null);
    setNome("");
    setDescricao("");
    setAcessos(normalizarAcessos({}));
    setModo("form");
  };

  const abrirEdicao = (p: PerfilPermissao) => {
    setEditando(p);
    setNome(p.nome);
    setDescricao(p.descricao ?? "");
    setAcessos(normalizarAcessos(p.acessos));
    setModo("form");
  };

  const salvar = () => {
    if (editando) {
      const res = atualizar(editando.id, { nome, descricao, acessos });
      if (res.erro) return toast.error(res.erro);
      toast.success("Perfil atualizado");
    } else {
      const res = adicionar({ nome, descricao, acessos });
      if ("erro" in res) return toast.error(res.erro);
      toast.success("Perfil criado");
    }
    setModo("lista");
  };

  const confirmarRemover = async (p: PerfilPermissao) => {
    const ok = await confirmDialog({
      title: "Remover perfil?",
      description: `Remover "${p.nome}"? Usuários já configurados não serão alterados.`,
    });
    if (!ok) return;
    remover(p.id);
    toast.success("Perfil removido");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Perfis de permissão</DialogTitle>
        </DialogHeader>

        {modo === "lista" ? (
          <>
            <div className="flex justify-end">
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4 mr-1" /> Novo perfil
              </Button>
            </div>
            <ScrollArea className="max-h-[60vh] mt-2">
              <div className="space-y-2 pr-3">
                {perfis.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum perfil cadastrado. Crie um perfil para reutilizar em novos usuários.
                  </p>
                )}
                {perfis.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 border border-border rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{p.nome}</p>
                      {p.descricao && (
                        <p className="text-xs text-muted-foreground">{p.descricao}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {PAGINAS_PERMISSAO.filter((k) => p.acessos[k] !== "nenhum")
                          .map((k) => `${pageLabels[k]}: ${nivelLabels[p.acessos[k]]}`)
                          .join(" · ") || "Nenhum acesso concedido"}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => abrirEdicao(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => confirmarRemover(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3 pr-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="mt-1"
                    placeholder="Opcional"
                  />
                </div>
                {PAGINAS_PERMISSAO.map((pg) => (
                  <div key={pg} className="flex items-center justify-between gap-3">
                    <Label className="text-sm">{pageLabels[pg]}</Label>
                    <Select
                      value={acessos[pg]}
                      onValueChange={(v) =>
                        setAcessos((prev) => ({ ...prev, [pg]: v as NivelAcesso }))
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(pg === "financeiro" ? financeiroNiveis : normalNiveis).map((n) => (
                          <SelectItem key={n} value={n}>
                            {nivelLabels[n]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModo("lista")}>
                Voltar
              </Button>
              <Button onClick={salvar} disabled={nome.trim().length < 2}>
                {editando ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
