/**
 * ETAPA 1 · Aba "Quadro" da configuração: identidade (nome/descrição),
 * aparência (cor de fundo) e visibilidade.
 *
 * A visibilidade é aplicada no banco pelas policies (`pode_ver_board`); aqui
 * apenas expomos a escolha ao administrador do quadro.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { boardsKeys, boardsQueryFns, useUpdateBoardConfig } from "@/hooks/quadros/useBoards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VISIBILIDADES = [
  { value: "privado", label: "Privado — somente membros convidados" },
  { value: "membros", label: "Membros — quem participa dos cards" },
  { value: "setor", label: "Setor — todos do setor do quadro" },
  { value: "empresa", label: "Empresa — qualquer usuário autenticado" },
] as const;

const CORES = [
  { value: "", label: "Padrão" },
  { value: "primary", label: "Primária" },
  { value: "secondary", label: "Secundária" },
  { value: "accent", label: "Destaque" },
  { value: "muted", label: "Neutra" },
];

interface Props {
  boardId: string;
  enabled: boolean;
}

export default function BoardIdentidadeTab({ boardId, enabled }: Props) {
  const updateMut = useUpdateBoardConfig();
  const cfg = useQuery({
    enabled,
    queryKey: boardsKeys.config(boardId),
    queryFn: () => boardsQueryFns.getBoardConfig(boardId),
  });

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [visibilidade, setVisibilidade] = useState("membros");
  const [fundoCor, setFundoCor] = useState("");

  useEffect(() => {
    const d = cfg.data as any;
    if (!d) return;
    setNome(d.nome ?? "");
    setDescricao(d.descricao ?? "");
    setVisibilidade(d.visibilidade ?? "membros");
    setFundoCor(d.fundo_cor ?? "");
  }, [cfg.data]);

  async function salvar() {
    try {
      await updateMut.mutateAsync({
        id: boardId,
        patch: {
          nome: nome.trim() || undefined,
          descricao: descricao.trim() || null,
          visibilidade,
          fundo_cor: fundoCor || null,
        },
      });
      toast.success("Quadro atualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="board-nome">Nome</Label>
        <Input id="board-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="board-descricao">Descrição</Label>
        <Textarea
          id="board-descricao"
          rows={3}
          placeholder="Para que serve este quadro?"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Visibilidade</Label>
          <Select value={visibilidade} onValueChange={setVisibilidade}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILIDADES.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Cor de fundo</Label>
          <Select value={fundoCor || "__default"} onValueChange={(v) => setFundoCor(v === "__default" ? "" : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CORES.map((c) => (
                <SelectItem key={c.value || "__default"} value={c.value || "__default"}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={salvar} disabled={updateMut.isPending || cfg.isLoading}>
          Salvar
        </Button>
      </div>
    </div>
  );
}
