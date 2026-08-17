import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRLFromNumber } from "@/lib/core/currency";
import { formatCompetencia } from "./DpFilterBar";
import { maskCPFDisplay } from "@/lib/dp/parser-holerite-xls";
import type { DpHoleriteRow } from "@/lib/repositories/dpHolerite";

interface Props {
  holerite: DpHoleriteRow | null;
  onClose: () => void;
}

export default function HoleriteDetailDialog({ holerite, onClose }: Props) {
  if (!holerite) return null;
  const proventos = holerite.verbas.filter((v) => v.tipo === "P");
  const descontos = holerite.verbas.filter((v) => v.tipo === "D");

  return (
    <Dialog open={!!holerite} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="space-y-1">
            <div>{holerite.nome_lido}</div>
            <div className="text-sm font-normal text-muted-foreground">
              CPF {maskCPFDisplay(holerite.cpf)} · {holerite.cargo_lido} ·{" "}
              {holerite.centro_custo_nome_lido} · Competência{" "}
              {formatCompetencia(holerite.competencia)}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Proventos" value={formatBRLFromNumber(holerite.proventos)} />
          <Stat label="Descontos" value={formatBRLFromNumber(holerite.descontos)} />
          <Stat label="Líquido" value={formatBRLFromNumber(holerite.liquido)} accent />
          <Stat label="Custo total" value={formatBRLFromNumber(holerite.custo_total)} />
          <Stat label="Salário base" value={formatBRLFromNumber(holerite.salario_base)} />
          <Stat label="FGTS" value={formatBRLFromNumber(holerite.fgts)} />
          <Stat label="INSS Empresa" value={formatBRLFromNumber(holerite.inss_empresa)} />
          <Stat
            label="Fator K"
            value={holerite.fator_k ? `${holerite.fator_k.toFixed(2)}x` : "—"}
          />
        </div>

        <h4 className="font-medium text-sm text-success mb-1">Proventos</h4>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proventos.map((v, i) => (
                <TableRow key={i}>
                  <TableCell>{v.codigo}</TableCell>
                  <TableCell>{v.descricao}</TableCell>
                  <TableCell className="text-right">{formatBRLFromNumber(v.valor)}</TableCell>
                </TableRow>
              ))}
              {proventos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-sm">
                    Nenhum provento
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <h4 className="font-medium text-sm text-destructive mb-1 mt-4">Descontos</h4>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {descontos.map((v, i) => (
                <TableRow key={i}>
                  <TableCell>{v.codigo}</TableCell>
                  <TableCell>{v.descricao}</TableCell>
                  <TableCell className="text-right">{formatBRLFromNumber(v.valor)}</TableCell>
                </TableRow>
              ))}
              {descontos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-sm">
                    Nenhum desconto
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <h4 className="font-medium text-sm mt-4 mb-1">Provisões e encargos</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <KV label="Provisão 13°" v={holerite.provisao_13} />
          <KV label="INSS Prov 13°" v={holerite.inss_provisao_13} />
          <KV label="FGTS Prov 13°" v={holerite.fgts_provisao_13} />
          <KV label="Provisão Férias" v={holerite.provisao_ferias} />
          <KV label="INSS Prov Férias" v={holerite.inss_provisao_ferias} />
          <KV label="FGTS Prov Férias" v={holerite.fgts_provisao_ferias} />
          <KV label="INSS Empresa" v={holerite.inss_empresa} />
          <KV label="RAT" v={holerite.rat} />
          <KV label="INSS Terceiros" v={holerite.inss_terceiros} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function KV({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span>{formatBRLFromNumber(v)}</span>
    </div>
  );
}
