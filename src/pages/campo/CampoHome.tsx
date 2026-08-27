/**
 * Portal de Campo — tela inicial. Se a pessoa está em mais de uma obra,
 * escolhe qual antes de ver os blocos de ação; com uma só, pula direto.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarRange, ClipboardList, NotebookPen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcessoRestrito } from "@/hooks/campo/useAcessoRestrito";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";

export default function CampoHome() {
  const navigate = useNavigate();
  const { obraIds, carregando } = useAcessoRestrito();
  const { obras } = useCatalogos();
  const [obraId, setObraId] = useState<string>("");

  const minhasObras = useMemo(
    () => obras.filter((o) => obraIds.includes(o.id)),
    [obras, obraIds],
  );
  const obraAtualId = obraIds.length === 1 ? obraIds[0] : obraId;
  const obraAtual = minhasObras.find((o) => o.id === obraAtualId);

  if (carregando) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (minhasObras.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Você ainda não está vinculado a nenhuma obra. Fale com o gestor responsável.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {minhasObras.length > 1 && (
        <Select value={obraAtualId} onValueChange={setObraId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a obra" />
          </SelectTrigger>
          <SelectContent>
            {minhasObras.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {obraAtual && (
        <>
          <div className="text-sm text-muted-foreground">{obraAtual.nome}</div>
          <div className="grid gap-3">
            <Tile
              icon={NotebookPen}
              titulo="Lançar RDO"
              descricao="Registro diário de obra de hoje"
              onClick={() => navigate(`/campo/rdo?obra=${obraAtual.id}`)}
            />
            <Tile
              icon={CalendarRange}
              titulo="Ver cronograma"
              descricao="Atividades da obra"
              onClick={() => navigate(`/campo/cronograma?obra=${obraAtual.id}`)}
            />
            <Tile
              icon={ClipboardList}
              titulo="Requisitar material"
              descricao="Pedido pro almoxarifado"
              onClick={() => navigate(`/campo/requisicao?obra=${obraAtual.id}`)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Tile({
  icon: Icon,
  titulo,
  descricao,
  onClick,
  disabled,
}: {
  icon: typeof NotebookPen;
  titulo: string;
  descricao: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Card
      role={disabled ? undefined : "button"}
      onClick={disabled ? undefined : onClick}
      className={disabled ? "opacity-60" : "cursor-pointer transition hover:bg-accent"}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <Icon className="h-8 w-8 text-primary" />
        <div>
          <div className="font-semibold">{titulo}</div>
          <div className="text-sm text-muted-foreground">{descricao}</div>
        </div>
      </CardContent>
    </Card>
  );
}
