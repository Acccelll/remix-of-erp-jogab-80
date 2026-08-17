/**
 * Resolução do QR (INSP.5c).
 *
 * Recebe `/inspecoes/qr/go/:alvoId`, lê o alvo e:
 * - se houver `modelo_id` padrão: redireciona para a captura com obra/local pré-preenchidos.
 * - senão: mostra picker simples de modelo.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode } from "lucide-react";

interface AlvoRow {
  id: string;
  obra_id: string;
  codigo: string;
  nome: string;
  local: string | null;
  modelo_id: string | null;
  ativa: boolean;
}

interface ModeloRow {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
}

export default function InspecoesQRGo() {
  const { alvoId = "" } = useParams();
  const navigate = useNavigate();
  const [redirected, setRedirected] = useState(false);

  const { data: alvo, isLoading } = useQuery({
    queryKey: ["qr-alvo", alvoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecao_qr_alvos")
        .select("id, obra_id, codigo, nome, local, modelo_id, ativa")
        .eq("id", alvoId)
        .maybeSingle();
      if (error) throw error;
      return data as AlvoRow | null;
    },
    enabled: !!alvoId,
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["inspecao-modelos-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecao_modelos")
        .select("id, codigo, nome, categoria")
        .order("codigo");
      if (error) throw error;
      return (data ?? []) as ModeloRow[];
    },
  });

  const params = useMemo(() => {
    if (!alvo) return "";
    const sp = new URLSearchParams();
    sp.set("obra", alvo.obra_id);
    if (alvo.local) sp.set("local", alvo.local);
    sp.set("qr", alvo.id);
    return sp.toString();
  }, [alvo]);

  // Auto-redirect se houver modelo padrão
  useEffect(() => {
    if (!alvo || redirected) return;
    if (alvo.ativa && alvo.modelo_id) {
      setRedirected(true);
      navigate(`/inspecoes/${alvo.modelo_id}?${params}`, { replace: true });
    }
  }, [alvo, params, navigate, redirected]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Lendo QR…</div>;
  }
  if (!alvo) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" /> QR não encontrado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Este QR não corresponde a nenhum alvo cadastrado, ou foi removido.
            </p>
            <Button onClick={() => navigate("/inspecoes")}>Ir para inspeções</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!alvo.ativa) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Alvo pausado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <Badge variant="outline">{alvo.codigo}</Badge> — {alvo.nome}
              <br />
              Este alvo está temporariamente pausado.
            </p>
            <Button onClick={() => navigate("/inspecoes")}>Ir para inspeções</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sem modelo padrão → escolher
  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> {alvo.nome}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{alvo.codigo}</Badge>
            {alvo.local && <span className="text-muted-foreground">{alvo.local}</span>}
          </div>
          <p className="text-muted-foreground">Selecione o modelo de inspeção a executar:</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {modelos.map((m) => (
          <Button
            key={m.id}
            variant="outline"
            className="h-auto py-3 px-3 justify-start text-left"
            onClick={() => navigate(`/inspecoes/${m.id}?${params}`)}
          >
            <div>
              <div className="font-medium">{m.codigo}</div>
              <div className="text-xs text-muted-foreground">{m.nome}</div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
