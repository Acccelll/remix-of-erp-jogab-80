// Fase 5 — CNAB: contas bancárias da empresa, geração de remessa a partir de
// um carrinho de "Previsão de Pagamento" fechado, e importação/conciliação
// de retorno.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Landmark, Plus, Upload, Loader2, Download, FileText } from "lucide-react";
import { PageLoading } from "@/components/common/PageLoading";
import {
  useContasBancarias,
  useCriarContaBancaria,
  useCnabRemessas,
  useGerarRemessaCnab,
  useCnabRetornos,
  useProcessarRetornoCnab,
  useCnabOcorrencias,
} from "@/hooks/financeiro/useCnab";
import { useFornecedoresCompleto } from "@/hooks/suprimentos/useFornecedores";
import { financeiroTotvsRepo } from "@/lib/repositories/financeiro";
import { cnabRepo, type ContaBancariaEmpresa } from "@/lib/repositories/cnab";
import { brl } from "@/lib/billing";
import { fmtData } from "@/lib/utils";

type FechadoItem = {
  id: string;
  ref_lancamento: number | null;
  solicitacao_id: string | null;
  nome: string | null;
  valor_congelado: number;
};

function normaliza(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((ch) => ch.charCodeAt(0) < 0x0300 || ch.charCodeAt(0) > 0x036f)
    .join("")
    .trim();
}

export default function Cnab() {
  const [params] = useSearchParams();
  const carrinhoId = params.get("carrinho");

  const contasQuery = useContasBancarias();
  const criarContaMut = useCriarContaBancaria();
  const remessasQuery = useCnabRemessas();
  const gerarRemessaMut = useGerarRemessaCnab();
  const retornosQuery = useCnabRetornos();
  const processarRetornoMut = useProcessarRetornoCnab();
  const fornecedoresQuery = useFornecedoresCompleto();

  const [contaFormOpen, setContaFormOpen] = useState(false);
  const [contaBancariaId, setContaBancariaId] = useState<string>("");
  const [fechadoItens, setFechadoItens] = useState<FechadoItem[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [fornecedorPorItem, setFornecedorPorItem] = useState<Record<string, string>>({});
  const [ocorrenciasAbertas, setOcorrenciasAbertas] = useState<string | null>(null);

  useEffect(() => {
    if (!carrinhoId) return;
    setLoadingItens(true);
    financeiroTotvsRepo
      .listCarrinhoFechadoItens(carrinhoId)
      .then((itens: any[]) => {
        setFechadoItens(itens);
        const fornecedores = fornecedoresQuery.data ?? [];
        const auto: Record<string, string> = {};
        for (const it of itens) {
          const alvo = normaliza(it.nome ?? "");
          const match = fornecedores.find(
            (f: any) => normaliza(f.razao_social) === alvo || normaliza(f.nome_fantasia ?? "") === alvo,
          );
          if (match) auto[it.id] = match.id;
        }
        setFornecedorPorItem(auto);
      })
      .catch((e: any) => toast.error("Erro ao carregar itens do carrinho", { description: e?.message }))
      .finally(() => setLoadingItens(false));
  }, [carrinhoId, fornecedoresQuery.data]);

  const fornecedorPorId = useMemo(
    () => new Map<string, any>((fornecedoresQuery.data ?? []).map((f: any) => [f.id, f])),
    [fornecedoresQuery.data],
  );

  const itensProntos = useMemo(() => {
    return fechadoItens.map((it) => {
      const forn = fornecedorPorItem[it.id] ? fornecedorPorId.get(fornecedorPorItem[it.id]) : null;
      const pronto = !!(forn?.banco_codigo && forn?.agencia && forn?.conta && forn?.cnpj);
      return { item: it, fornecedor: forn, pronto };
    });
  }, [fechadoItens, fornecedorPorItem, fornecedorPorId]);

  const todosProntos = itensProntos.length > 0 && itensProntos.every((x) => x.pronto);
  const contaSelecionada = (contasQuery.data ?? []).find((c) => c.id === contaBancariaId);

  const [novaConta, setNovaConta] = useState({
    banco_codigo: "",
    banco_nome: "",
    agencia: "",
    agencia_dv: "",
    conta: "",
    conta_dv: "",
    convenio: "",
    carteira: "",
    cnpj: "",
    razao_social: "",
    ativo: true,
  });

  async function salvarConta() {
    if (!novaConta.banco_codigo || !novaConta.agencia || !novaConta.conta || !novaConta.convenio) {
      toast.error("Preencha banco, agência, conta e convênio.");
      return;
    }
    try {
      await criarContaMut.mutateAsync(novaConta);
      toast.success("Conta bancária cadastrada.");
      setContaFormOpen(false);
    } catch {
      // erro já notificado
    }
  }

  async function gerarRemessa() {
    if (!carrinhoId || !contaSelecionada) {
      toast.error("Selecione a conta bancária pagadora.");
      return;
    }
    const itens = itensProntos
      .filter((x) => x.pronto)
      .map(({ item, fornecedor }) => ({
        origem_tipo: (item.solicitacao_id ? "solicitacao" : "ref_lancamento") as "solicitacao" | "ref_lancamento",
        origem_id: item.solicitacao_id ? String(item.solicitacao_id) : String(item.ref_lancamento),
        favorecido_nome: fornecedor.razao_social,
        favorecido_documento: String(fornecedor.cnpj).replace(/\D/g, ""),
        favorecido_banco: fornecedor.banco_codigo,
        favorecido_agencia: fornecedor.agencia,
        favorecido_agencia_dv: fornecedor.agencia_dv ?? null,
        favorecido_conta: fornecedor.conta,
        favorecido_conta_dv: fornecedor.conta_dv ?? null,
        valor: Number(item.valor_congelado),
      }));
    try {
      await gerarRemessaMut.mutateAsync({
        carrinhoId,
        contaBancariaId: contaSelecionada.id,
        empresa: {
          cnpj: contaSelecionada.cnpj,
          nome: contaSelecionada.razao_social,
          bancoCodigo: contaSelecionada.banco_codigo,
          bancoNome: contaSelecionada.banco_nome,
          agencia: contaSelecionada.agencia,
          agenciaDv: contaSelecionada.agencia_dv ?? undefined,
          conta: contaSelecionada.conta,
          contaDv: contaSelecionada.conta_dv ?? undefined,
          convenio: contaSelecionada.convenio,
        },
        itens,
      });
    } catch {
      // erro já notificado
    }
  }

  async function baixarRemessa(path: string, numeroArquivo: number) {
    try {
      const blob = await cnabRepo.baixarArquivoRemessa(path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `remessa-${numeroArquivo}.rem`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Erro ao baixar remessa", { description: e?.message });
    }
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const [bancoRetorno, setBancoRetorno] = useState("");

  async function handleRetornoFile(file: File) {
    if (!bancoRetorno.trim()) {
      toast.error("Informe o código do banco antes de importar o retorno.");
      return;
    }
    try {
      await processarRetornoMut.mutateAsync({ file, bancoCodigo: bancoRetorno.trim() });
    } catch {
      // erro já notificado
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold flex items-center gap-2">
        <Landmark className="h-6 w-6" /> CNAB — Remessa &amp; Retorno
      </h2>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Contas bancárias da empresa</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setContaFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova conta
          </Button>
        </CardHeader>
        <CardContent>
          {contasQuery.isLoading ? (
            <PageLoading />
          ) : (contasQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta bancária cadastrada.</p>
          ) : (
            <div className="grid gap-2">
              {(contasQuery.data ?? []).map((c) => (
                <div key={c.id} className="text-sm border border-border rounded-md p-2 flex justify-between">
                  <span>
                    {c.banco_nome} ({c.banco_codigo}) — Ag {c.agencia} / Cc {c.conta}
                  </span>
                  <span className="text-muted-foreground text-xs">Convênio {c.convenio}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {carrinhoId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gerar remessa a partir do carrinho fechado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-xs">
              <Label>Conta bancária pagadora</Label>
              <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(contasQuery.data ?? []).map((c: ContaBancariaEmpresa) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.banco_nome} — Cc {c.conta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingItens ? (
              <PageLoading />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Fornecedor (dados bancários)</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensProntos.map(({ item, pronto }) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.nome ?? "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={fornecedorPorItem[item.id] ?? ""}
                          onValueChange={(v) => setFornecedorPorItem((p) => ({ ...p, [item.id]: v }))}
                        >
                          <SelectTrigger className="h-8 w-64">
                            <SelectValue placeholder="Selecione o fornecedor..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(fornecedoresQuery.data ?? []).map((f: any) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.razao_social}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!pronto && fornecedorPorItem[item.id] && (
                          <p className="text-xs text-destructive mt-1">
                            Fornecedor sem dados bancários/CNPJ completos.
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{brl(Number(item.valor_congelado))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Button
              onClick={gerarRemessa}
              disabled={!todosProntos || !contaBancariaId || gerarRemessaMut.isPending}
            >
              {gerarRemessaMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Gerar remessa CNAB
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Remessas geradas</CardTitle>
        </CardHeader>
        <CardContent>
          {remessasQuery.isLoading ? (
            <PageLoading />
          ) : (remessasQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma remessa gerada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº arquivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gerada em</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(remessasQuery.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.numero_arquivo}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{fmtData(r.gerada_em)}</TableCell>
                    <TableCell>
                      {r.arquivo_path && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => baixarRemessa(r.arquivo_path!, r.numero_arquivo)}
                        >
                          <Download className="h-4 w-4 mr-1" /> Baixar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Importar retorno bancário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="w-40">
              <Label>Código do banco</Label>
              <Input value={bancoRetorno} onChange={(e) => setBancoRetorno(e.target.value)} className="mt-1" />
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".ret,.txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleRetornoFile(f);
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={processarRetornoMut.isPending}
              >
                {processarRetornoMut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Importar arquivo de retorno
              </Button>
            </div>
          </div>

          {retornosQuery.isLoading ? (
            <PageLoading />
          ) : (retornosQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum retorno importado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Importado em</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(retornosQuery.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.banco_codigo}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "com_erros" ? "destructive" : "outline"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{fmtData(r.importado_em)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setOcorrenciasAbertas(r.id)}>
                        <FileText className="h-4 w-4 mr-1" /> Ocorrências
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={contaFormOpen} onOpenChange={setContaFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova conta bancária</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Código do banco *</Label>
              <Input
                value={novaConta.banco_codigo}
                onChange={(e) => setNovaConta((s) => ({ ...s, banco_codigo: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Nome do banco</Label>
              <Input
                value={novaConta.banco_nome}
                onChange={(e) => setNovaConta((s) => ({ ...s, banco_nome: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Agência *</Label>
              <Input
                value={novaConta.agencia}
                onChange={(e) => setNovaConta((s) => ({ ...s, agencia: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>DV Agência</Label>
              <Input
                value={novaConta.agencia_dv}
                onChange={(e) => setNovaConta((s) => ({ ...s, agencia_dv: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Conta *</Label>
              <Input
                value={novaConta.conta}
                onChange={(e) => setNovaConta((s) => ({ ...s, conta: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>DV Conta</Label>
              <Input
                value={novaConta.conta_dv}
                onChange={(e) => setNovaConta((s) => ({ ...s, conta_dv: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Convênio *</Label>
              <Input
                value={novaConta.convenio}
                onChange={(e) => setNovaConta((s) => ({ ...s, convenio: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Carteira</Label>
              <Input
                value={novaConta.carteira}
                onChange={(e) => setNovaConta((s) => ({ ...s, carteira: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>CNPJ da empresa</Label>
              <Input
                value={novaConta.cnpj}
                onChange={(e) => setNovaConta((s) => ({ ...s, cnpj: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Razão social</Label>
              <Input
                value={novaConta.razao_social}
                onChange={(e) => setNovaConta((s) => ({ ...s, razao_social: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContaFormOpen(false)} disabled={criarContaMut.isPending}>
              Cancelar
            </Button>
            <Button onClick={salvarConta} disabled={criarContaMut.isPending}>
              {criarContaMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ocorrenciasAbertas} onOpenChange={(o) => !o && setOcorrenciasAbertas(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ocorrências do retorno</DialogTitle>
          </DialogHeader>
          {ocorrenciasAbertas && <OcorrenciasRetorno retornoId={ocorrenciasAbertas} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OcorrenciasRetorno({ retornoId }: { retornoId: string }) {
  const ocorrenciasQuery = useCnabOcorrencias(retornoId);
  if (ocorrenciasQuery.isLoading) return <PageLoading />;
  const ocorrencias = ocorrenciasQuery.data ?? [];
  if (ocorrencias.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhuma ocorrência encontrada.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nosso número</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Data</TableHead>
          <TableHead className="text-right">Valor pago</TableHead>
          <TableHead>Conciliado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ocorrencias.map((o) => (
          <TableRow key={o.id}>
            <TableCell className="font-mono text-xs">{o.nosso_numero}</TableCell>
            <TableCell>{o.codigo_ocorrencia ?? "—"}</TableCell>
            <TableCell className="text-xs">{o.data_ocorrencia ? fmtData(o.data_ocorrencia) : "—"}</TableCell>
            <TableCell className="text-right">{brl(Number(o.valor_pago))}</TableCell>
            <TableCell>
              <Badge variant={o.conciliado ? "outline" : "destructive"}>
                {o.conciliado ? "Sim" : "Sem título correspondente"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
