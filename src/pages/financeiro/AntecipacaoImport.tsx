import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Upload,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl } from "@/lib/billing";
import { fmtData } from "@/lib/utils";
import { antecipacaoRepo } from "@/lib/repositories/antecipacao";
import { Skeleton } from "@/components/ui/skeleton";

export default function AntecipacaoImport() {
  const [search, setSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: elegiveis, isLoading } = useQuery({
    queryKey: ["antecipacao-elegiveis"],
    queryFn: () => antecipacaoRepo.listElegiveis(),
  });

  const filtered = useMemo(() => {
    if (!elegiveis) return [];
    const s = search.toLowerCase();
    return elegiveis.filter(
      (nf) =>
        nf.numero_nfse?.toLowerCase().includes(s) ||
        nf.tomador_razao?.toLowerCase().includes(s) ||
        nf.obra?.nome?.toLowerCase().includes(s),
    );
  }, [elegiveis, search]);

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRows(next);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/financeiro/antecipacao">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Importação & Conciliação</h1>
            <p className="text-sm text-muted-foreground">
              Vincule notas fiscais do faturamento às operações de antecipação.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" /> Importar Planilha
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                Aguardando Vínculo
              </span>
            </div>
            <div className="text-3xl font-bold">{filtered.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Notas fiscais emitidas sem antecipação registrada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Conciliadas</span>
            </div>
            <div className="text-3xl font-bold">—</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de títulos já vinculados a operações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-warning mb-2">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Alertas</span>
            </div>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              Vencimentos divergentes ou valores não batem
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Notas Fiscais Disponíveis</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nota, tomador ou obra..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Nº NFSe</TableHead>
                <TableHead>Tomador / Cliente</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor Líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((nf) => (
                <React.Fragment key={nf.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleRow(nf.id)}
                  >
                    <TableCell>
                      {expandedRows.has(nf.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{nf.numero_nfse}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={nf.tomador_razao}>
                      {nf.tomador_razao}
                    </TableCell>
                    <TableCell>{nf.obra?.nome ?? "—"}</TableCell>
                    <TableCell>{fmtData(nf.data_emissao)}</TableCell>
                    <TableCell
                      className={cn(
                        new Date(nf.data_vencimento) < new Date() && "text-destructive font-medium",
                      )}
                    >
                      {fmtData(nf.data_vencimento)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {brl(nf.valor_liquido)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {nf.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(nf.id) && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={9} className="p-4">
                        <div className="flex gap-6 items-start">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">
                              Detalhes da Emissão
                            </p>
                            <p className="text-sm">Valor Serviços: {brl(nf.valor_servicos)}</p>
                            <p className="text-sm">
                              Vencimento Original: {fmtData(nf.vencimento_origem)}
                            </p>
                          </div>
                          <div className="border-l pl-6 space-y-2">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">
                              Ações de Conciliação
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  toast.info("Selecione a operação para vincular", {
                                    description:
                                      "Esta funcionalidade será integrada ao fluxo de criação de operação na próxima etapa.",
                                  });
                                }}
                              >
                                Vincular a Operação
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive">
                                Marcar como Indisponível
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Nenhuma nota fiscal pendente encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import React from "react";
import { cn } from "@/lib/utils";
