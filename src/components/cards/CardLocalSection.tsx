/**
 * CardLocalSection — bloco opcional de Local no card.
 *
 * Persiste em `public.card_local` (uma linha por card). Não trava se o
 * usuário só preencher endereço — lat/lng são opcionais e exibidos como
 * link p/ Google Maps quando presentes.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cardsKeys, cardsQueryFns, useUpsertCardLocal, useRemoveCardLocalByCard } from "@/hooks/quadros/useCards";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Trash2, ExternalLink } from "lucide-react";

interface Props {
  cardId: string;
  readOnly?: boolean;
}

interface LocalRow {
  card_id: string;
  endereco: string | null;
  lat: number | null;
  lng: number | null;
}

export default function CardLocalSection({ cardId, readOnly }: Props) {
  const upsertLocalMut = useUpsertCardLocal();
  const removeLocalMut = useRemoveCardLocalByCard();
  const q = useQuery({
    queryKey: cardsKeys.local(cardId),
    queryFn: async (): Promise<LocalRow | null> => {
      return (await cardsQueryFns.getLocalByCard(cardId)) as LocalRow | null;
    },
  });

  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  useEffect(() => {
    setEndereco(q.data?.endereco ?? "");
    setLat(q.data?.lat?.toString() ?? "");
    setLng(q.data?.lng?.toString() ?? "");
  }, [q.data]);

  async function salvar() {
    const latN = lat.trim() === "" ? null : Number(lat);
    const lngN = lng.trim() === "" ? null : Number(lng);
    if (latN !== null && Number.isNaN(latN)) return toast.error("Latitude inválida");
    if (lngN !== null && Number.isNaN(lngN)) return toast.error("Longitude inválida");
    const payload = {
      card_id: cardId,
      endereco: endereco.trim() || null,
      lat: latN,
      lng: lngN,
    };
    const { error } = await upsertLocalMut.mutateAsync(payload);
    if (error) return toast.error(error.message);
    toast.success("Local salvo");
  }

  async function remover() {
    const { error } = await removeLocalMut.mutateAsync(cardId);
    if (error) return toast.error(error.message);
    setEndereco("");
    setLat("");
    setLng("");
  }

  const mapsHref =
    q.data?.lat != null && q.data?.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${q.data.lat},${q.data.lng}`
      : q.data?.endereco
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.data.endereco)}`
        : null;

  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" /> Local
      </div>
      <div className="space-y-1.5">
        <Input
          className="h-8"
          placeholder="Endereço"
          value={endereco}
          disabled={readOnly}
          onChange={(e) => setEndereco(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-1.5">
          <Input
            className="h-8"
            placeholder="Lat"
            value={lat}
            disabled={readOnly}
            onChange={(e) => setLat(e.target.value)}
          />
          <Input
            className="h-8"
            placeholder="Lng"
            value={lng}
            disabled={readOnly}
            onChange={(e) => setLng(e.target.value)}
          />
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={salvar}>
              Salvar
            </Button>
            {q.data && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive"
                onClick={remover}
                title="Remover local"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 ml-auto"
              >
                Abrir <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
