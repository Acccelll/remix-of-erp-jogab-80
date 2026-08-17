import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CheckCircle2, AlertCircle, Calendar, Pencil, Trash2 } from "lucide-react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useFuncoesContext } from "@/contexts/FuncoesContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { useColaboradorDp } from "@/hooks/dp/useColaboradorDp";
import { cn, formatCPF, fmtData } from "@/lib/utils";
import { rotuloStatus, STATUS_TONE_CLASSES } from "@/lib/rh/statusHistorico";
import DatePickerField from "@/components/common/DatePickerField";
import EmployeeFormDialog from "@/components/rh/EmployeeFormDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeriasEntry, DocumentoVencimento } from "@/types";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import HistoricoSection from "@/components/common/HistoricoSection";
import { ComentariosPanel } from "@/components/common/ComentariosPanel";
import CollapsibleSection from "@/components/common/CollapsibleSection";

interface Props {
  open: boolean;
  onClose: () => void;
  colaboradorId: string | null;
  defaultTab?: string;
}

// Helper para extrair apenas dígitos de uma string (ex: "10 dias" → "10")
const getNumericValue = (val: string | undefined): string => {
  if (!val) return "";
  const match = val.match(/\d+/);
  return match ? match[0] : "";
};

const EmployeeProfileDialog: React.FC<Props> = ({
  open,
  onClose,
  colaboradorId,
  defaultTab = "ficha",
}) => {
  const { colaboradores, updateColaborador } = useColaboradoresContext();
  const { obras } = useObrasContext();
  const { hasAccess } = usePermissions();
  const { funcoes, documentosTipo } = useFuncoesContext();
  const colab = colaboradores.find((c) => c.id === colaboradorId);
  const canEdit = hasAccess("rh", "editar");
  const [newDocNome, setNewDocNome] = useState("");
  const [newDocData, setNewDocData] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const { mobPeriodos } = useColaboradorDp(colaboradorId, open);

  if (!colab) return null;

  // Função auxiliar para evitar enviar payloads vazios ou sem alterações reais
  const safeUpdate = (updates: any) => {
    let hasChange = false;
    for (const key of Object.keys(updates)) {
      const newVal = updates[key];
      const oldVal = (colab as any)[key];
      if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
        hasChange = true;
        break;
      }
    }
    if (!hasChange) {
      console.debug("safeUpdate: nenhuma alteração detectada, ignorando requisição.");
      return;
    }
    updateColaborador(colab.id, updates);
  };

  const obrasComIntegracao = obras.filter((o) => o.requerIntegracao && o.ativa);
  const funcaoObj = funcoes.find((f) => f.nome === colab.funcao && f.ativa);
  const requiredNRs = funcaoObj?.nrs || [];
  const ferias = colab.ferias || [];

  // ── Sync Férias ↔ Documentos ──────────────────────────────────
  const syncFeriasDocument = (
    updatedFerias: FeriasEntry[],
    currentDocs: DocumentoVencimento[],
  ): DocumentoVencimento[] => {
    const target =
      [...updatedFerias].reverse().find((f) => !f.quitado) ||
      updatedFerias[updatedFerias.length - 1];
    if (!target) {
      return currentDocs.filter((d) => d.nome !== "Férias");
    }
    const existingDoc = currentDocs.find((d) => d.nome === "Férias" && d.feriasId === target.id);
    if (existingDoc) {
      return currentDocs.map((d) =>
        d.id === existingDoc.id ? { ...d, dataVencimento: target.vencimento || "" } : d,
      );
    }
    const legacyDoc = currentDocs.find((d) => d.nome === "Férias" && !d.feriasId);
    if (legacyDoc) {
      return currentDocs.map((d) =>
        d.id === legacyDoc.id
          ? { ...d, feriasId: target.id, dataVencimento: target.vencimento || "" }
          : d,
      );
    }
    return [
      ...currentDocs,
      {
        id: crypto.randomUUID(),
        nome: "Férias",
        dataVencimento: target.vencimento || "",
        obrigatorio: false,
        feriasId: target.id,
      },
    ];
  };

  const handleAddIntegracao = (obraId: string, obraNome: string, data: string) => {
    if (!data) return;
    const newIntegracoes = [
      ...colab.integracoes.filter((i) => i.obraId !== obraId),
      { obraId, obraNome, dataIntegracao: data },
    ];
    const vencDate = new Date(data);
    vencDate.setFullYear(vencDate.getFullYear() + 1);
    const newDoc = {
      id: crypto.randomUUID(),
      nome: `Integração ${obraNome}`,
      dataVencimento: vencDate.toISOString().split("T")[0],
      obrigatorio: false,
    };
    const existingDocNames = colab.documentos.map((d) => d.nome);
    const docs = existingDocNames.includes(newDoc.nome)
      ? colab.documentos.map((d) =>
          d.nome === newDoc.nome ? { ...d, dataVencimento: newDoc.dataVencimento } : d,
        )
      : [...colab.documentos, newDoc];
    safeUpdate({ integracoes: newIntegracoes, documentos: docs });
  };

  const handleAddDocumento = () => {
    if (!newDocNome || !newDocData) return;
    const emissaoDate = new Date(newDocData);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (emissaoDate > today) {
      toast.warning("Data de emissão futura — pode gerar alerta de vencimento enganoso.");
    }
    const tipo = documentosTipo.find((dt) => dt.nome === newDocNome);
    let dataVencimento = newDocData;
    if (tipo && tipo.vencimentoDias > 0) {
      const emissao = new Date(newDocData);
      emissao.setDate(emissao.getDate() + tipo.vencimentoDias);
      dataVencimento = emissao.toISOString().split("T")[0];
    }
    safeUpdate({
      documentos: [
        ...colab.documentos,
        { id: crypto.randomUUID(), nome: newDocNome, dataVencimento, obrigatorio: false },
      ],
    });
    setNewDocNome("");
    setNewDocData("");
  };

  const handleUpdateDocVencimento = (docId: string, newDate: string) => {
    const doc = colab.documentos.find((d) => d.id === docId);
    const updatedDocs = colab.documentos.map((d) =>
      d.id === docId ? { ...d, dataVencimento: newDate } : d,
    );
    const updates: any = { documentos: updatedDocs };
    if (doc?.nome === "Férias" && ferias.length > 0) {
      if (doc.feriasId) {
        updates.ferias = ferias.map((f) =>
          f.id === doc.feriasId ? { ...f, vencimento: newDate } : f,
        );
      } else {
        const updatedFerias = [...ferias];
        updatedFerias[updatedFerias.length - 1] = {
          ...updatedFerias[updatedFerias.length - 1],
          vencimento: newDate,
        };
        updates.ferias = updatedFerias;
      }
    }
    safeUpdate(updates);
  };

  const handleAddFerias = () => {
    const newEntry: FeriasEntry = {
      id: crypto.randomUUID(),
      quitado: false,
      diasQuitados: "",
      afastamento: "",
      faltas: "",
      vencimento: "",
      limiteConcessao: "",
    };
    const updatedFerias = [...ferias, newEntry];
    const updatedDocs = syncFeriasDocument(updatedFerias, colab.documentos);
    safeUpdate({ ferias: updatedFerias, documentos: updatedDocs });
  };

  const handleUpdateFerias = (id: string, field: keyof FeriasEntry, value: any) => {
    let processedValue = value;
    // Sanitiza campos numéricos: extrai apenas dígitos
    if (field === "diasQuitados" || field === "faltas") {
      const num = getNumericValue(value);
      processedValue = num;
    }
    const updatedFerias = ferias.map((f) => (f.id === id ? { ...f, [field]: processedValue } : f));
    const updates: any = { ferias: updatedFerias };
    if (field === "vencimento") {
      const linkedDoc = colab.documentos.find((d) => d.nome === "Férias" && d.feriasId === id);
      if (linkedDoc) {
        updates.documentos = colab.documentos.map((d) =>
          d.id === linkedDoc.id ? { ...d, dataVencimento: processedValue } : d,
        );
      } else {
        updates.documentos = syncFeriasDocument(updatedFerias, colab.documentos);
      }
    }
    safeUpdate(updates);
  };

  const handleDeleteFerias = (id: string) => {
    const updatedFerias = ferias.filter((f) => f.id !== id);
    let updatedDocs = colab.documentos.filter((d) => !(d.nome === "Férias" && d.feriasId === id));
    if (updatedFerias.length > 0) {
      const hasAnyFeriasDoc = updatedDocs.some((d) => d.nome === "Férias");
      if (!hasAnyFeriasDoc) {
        updatedDocs = syncFeriasDocument(updatedFerias, updatedDocs);
      }
    }
    safeUpdate({ ferias: updatedFerias, documentos: updatedDocs });
  };

  const isExpiringSoon = (dateStr: string, docNome?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    let avisoDias = 7;
    if (docNome) {
      const tipo = documentosTipo.find((dt) => dt.nome === docNome);
      if (tipo) avisoDias = tipo.avisoDias;
    }
    const limit = new Date(now.getTime() + avisoDias * 86400000);
    return d <= limit && d >= now;
  };

  const isExpired = (dateStr: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] p-0 flex flex-col"
        aria-describedby="employee-dialog-desc"
      >
        <DialogHeader className="p-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="matricula-badge">{colab.matricula.padStart(4, "0")}</div>
            <div>
              <DialogTitle className="font-display">{colab.nome}</DialogTitle>
              <p className="text-sm text-muted-foreground">{colab.funcao}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
              )}
              {/* Férias/folga/afastamento não são "inativo", mas também não são
                  simplesmente "ativo": sem este badge, o perfil não dizia em
                  lugar nenhum que o colaborador estava fora da obra. */}
              {colab.ativo && colab.statusEspecial && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    STATUS_TONE_CLASSES[rotuloStatus(String(colab.statusEspecial)).tone],
                  )}
                >
                  {rotuloStatus(String(colab.statusEspecial)).label}
                </Badge>
              )}
              <Badge variant={colab.ativo ? "default" : "secondary"}>
                {colab.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
          <DialogDescription id="employee-dialog-desc" className="sr-only">
            Perfil do colaborador {colab.nome} - matrícula {colab.matricula.padStart(4, "0")}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={defaultTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <TabsList className="mx-6 grid grid-cols-5 shrink-0">
            <TabsTrigger value="ficha">Dados</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="responsabilidade">Responsabilidade</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <TabsContent value="ficha" className="p-6 pt-4 mt-0">
              <div className="grid grid-cols-3 gap-4">
                <Row label="Matrícula" value={colab.matricula.padStart(4, "0")} />
                <Row label="Nome" value={colab.nome} />
                <Row label="Gênero" value={colab.genero} />
                <Row label="Data de Nascimento" value={fmtData(colab.dataNascimento)} />
                <Row label="Cidade" value={colab.cidade} />
                <Row label="Etnia" value={colab.etnia} />
                <Row label="Estado Civil" value={colab.estadoCivil} />
                <Row label="Cônjuge" value={colab.nomeConjuge} />
                <Row label="Nacionalidade" value={colab.nacionalidade} />
                <Row label="Mãe" value={colab.nomeMae} />
                <Row label="Pai" value={colab.nomePai} />
                <Row label="CEP" value={colab.cep} />
                <Row label="Endereço" value={colab.endereco} />
                <Row label="RG" value={colab.rg} />
                <Row label="Emissão RG" value={fmtData(colab.dataEmissaoRG)} />
                <Row label="Órgão/UF" value={`${colab.orgaoEmissorRG} ${colab.ufEmissorRG}`} />
                <Row label="CPF" value={formatCPF(colab.cpf)} />
                <Row label="PIS" value={colab.pis} />
                <Row label="Admissão" value={fmtData(colab.dataAdmissao)} />
                <Row label="Função" value={colab.funcao} />
                <Row label="Salário" value={colab.salario ? `R$ ${colab.salario}` : ""} />
                <Row label="Forma" value={colab.formaSalario === "mensal" ? "Mensal" : "Horista"} />
                {!colab.ativo && colab.dataRescisao && (
                  <Row label="Data da Rescisão" value={fmtData(colab.dataRescisao)} />
                )}
              </div>
              <Separator className="my-4" />
              <CollapsibleSection title="Dados Bancários" storageKey="employee:bancarios">
                <div className="grid grid-cols-3 gap-4">
                  <Row label="Banco" value={colab.banco || ""} />
                  <Row label="Nº do Banco" value={colab.numeroBanco || ""} />
                  <Row label="Agência" value={colab.agencia || ""} />
                  <Row label="Nº da Conta" value={colab.numeroConta || ""} />
                  <Row label="Tipo da Conta" value={colab.tipoConta || ""} />
                  <Row label="Tipo da Chave Pix" value={colab.tipoChavePix || ""} />
                  <Row label="Nº da Chave Pix" value={colab.chavePix || ""} />
                </div>
              </CollapsibleSection>
            </TabsContent>
            <TabsContent value="integracoes" className="p-6 pt-4 mt-0 space-y-3">
              {requiredNRs.length > 0 && (
                <div className="p-3 rounded-lg border border-accent/30 bg-accent/5 mb-3">
                  <p className="text-xs font-semibold text-accent-foreground mb-1">
                    NRs obrigatórias para {colab.funcao}:
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {requiredNRs.map((nr) => {
                      const hasDoc = colab.documentos.some((d) => d.nome === nr);
                      return (
                        <Badge
                          key={nr}
                          variant={hasDoc ? "default" : "outline"}
                          className="text-xs"
                        >
                          {nr} {hasDoc ? "✓" : "✗"}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
              {obrasComIntegracao.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma obra ativa requer integração.
                </p>
              )}
              {obrasComIntegracao.map((obra) => {
                const existing = colab.integracoes.find((i) => i.obraId === obra.id);
                return (
                  <div
                    key={obra.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  >
                    {existing ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-warning shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{obra.nome}</p>
                      <p className="text-xs text-muted-foreground">{obra.integracaoInfo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <DatePickerField
                        value={existing?.dataIntegracao || ""}
                        onChange={(v) => handleAddIntegracao(obra.id, obra.nome, v)}
                        className="w-36"
                        inputClassName="h-8 text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="documentos" className="p-6 pt-4 mt-0 space-y-6">
              <CollapsibleSection title="Férias" storageKey="employee:ferias">
                {ferias.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2 text-center">
                    Nenhum registro de férias.
                  </p>
                )}
                {ferias.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[60px_60px_1fr_1fr_1fr_1fr_40px] gap-0 bg-muted/50 text-xs font-semibold text-muted-foreground">
                      <div className="p-2 text-center">Quitado</div>
                      <div className="p-2 text-center">Dias</div>
                      <div className="p-2">Afastamento</div>
                      <div className="p-2">Faltas</div>
                      <div className="p-2">Vencimento</div>
                      <div className="p-2">Limite Concessão</div>
                      <div className="p-2"></div>
                    </div>
                    {ferias.map((f) => (
                      <div
                        key={f.id}
                        className="grid grid-cols-[60px_60px_1fr_1fr_1fr_1fr_40px] gap-0 border-t border-border items-center"
                      >
                        <div className="p-2 flex justify-center">
                          <Checkbox
                            checked={f.quitado}
                            onCheckedChange={(v) => handleUpdateFerias(f.id, "quitado", !!v)}
                          />
                        </div>
                        <div className="p-1">
                          <Input
                            value={getNumericValue(f.diasQuitados)}
                            onChange={(e) =>
                              handleUpdateFerias(f.id, "diasQuitados", e.target.value)
                            }
                            placeholder="0"
                            className="h-8 text-xs text-center"
                            type="number"
                          />
                        </div>
                        <div className="p-1">
                          <DatePickerField
                            value={f.afastamento}
                            onChange={(v) => handleUpdateFerias(f.id, "afastamento", v)}
                            inputClassName="h-8 text-xs"
                          />
                        </div>
                        <div className="p-1">
                          <Input
                            value={getNumericValue(f.faltas)}
                            onChange={(e) => handleUpdateFerias(f.id, "faltas", e.target.value)}
                            placeholder="0"
                            className="h-8 text-xs"
                            type="number"
                          />
                        </div>
                        <div className="p-1">
                          <DatePickerField
                            value={f.vencimento}
                            onChange={(v) => handleUpdateFerias(f.id, "vencimento", v)}
                            inputClassName="h-8 text-xs"
                          />
                        </div>
                        <div className="p-1">
                          <DatePickerField
                            value={f.limiteConcessao}
                            onChange={(v) => handleUpdateFerias(f.id, "limiteConcessao", v)}
                            inputClassName="h-8 text-xs"
                          />
                        </div>
                        <div className="p-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDeleteFerias(f.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={handleAddFerias} className="mt-2">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Período
                  </Button>
                )}
              </CollapsibleSection>

              <CollapsibleSection title="Documentos de Vencimento" storageKey="employee:documentos">
                {colab.documentos.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2 text-center">
                    Nenhum documento cadastrado.
                  </p>
                )}
                {colab.documentos.map((doc) => {
                  const expiringSoon = isExpiringSoon(doc.dataVencimento, doc.nome);
                  const expired = isExpired(doc.dataVencimento);
                  const tipo = documentosTipo.find((dt) => dt.nome === doc.nome);
                  const avisoDias = tipo?.avisoDias || 7;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border mb-2"
                    >
                      <Calendar
                        className={`h-4 w-4 shrink-0 ${expired ? "text-destructive" : expiringSoon ? "text-warning" : "text-muted-foreground"}`}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {doc.nome}{" "}
                          {doc.obrigatorio && <span className="text-xs text-destructive">*</span>}
                        </p>
                        {doc.dataVencimento && (
                          <p
                            className={`text-xs ${expired ? "text-destructive font-bold" : expiringSoon ? "text-warning font-semibold" : "text-muted-foreground"}`}
                          >
                            Vence: {fmtData(doc.dataVencimento)}
                            {expired && " (VENCIDO)"}
                            {expiringSoon && ` (vence em ${avisoDias} dias ou menos)`}
                          </p>
                        )}
                      </div>
                      <DatePickerField
                        value={doc.dataVencimento}
                        onChange={(v) => handleUpdateDocVencimento(doc.id, v)}
                        className="w-36"
                        inputClassName="h-8 text-xs"
                      />
                    </div>
                  );
                })}
                <Separator className="my-3" />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Documento</Label>
                    <Select value={newDocNome} onValueChange={setNewDocNome}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione um documento..." />
                      </SelectTrigger>
                      <SelectContent>
                        {documentosTipo
                          .filter((dt) => !colab.documentos.some((d) => d.nome === dt.nome))
                          .map((dt) => (
                            <SelectItem key={dt.id} value={dt.nome}>
                              {dt.nome} ({dt.vencimentoDias}d / {dt.avisoDias}d aviso)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Data de Emissão</Label>
                    <DatePickerField value={newDocData} onChange={setNewDocData} className="mt-1" />
                  </div>
                  <Button type="button" size="sm" onClick={handleAddDocumento}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CollapsibleSection>
            </TabsContent>

            <TabsContent value="responsabilidade" className="p-6 pt-4 mt-0 space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                Marque as páginas em que este colaborador deve aparecer como coluna responsável.
              </p>
              {[
                { key: "quadroPatrimonios", label: "Gestão de Patrimônios" },
                { key: "quadroVeiculos", label: "Motorista (Veículos)" },
              ].map((item) => {
                const checked = (colab.responsabilidades || []).includes(item.key);
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const current = colab.responsabilidades || [];
                        const next = v
                          ? [...current, item.key]
                          : current.filter((r) => r !== item.key);
                        safeUpdate({ responsabilidades: next });
                      }}
                      disabled={!canEdit}
                    />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                );
              })}
            </TabsContent>
            <TabsContent value="historico" className="p-6 pt-4 mt-0 space-y-6">
              {colab && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Comentários</h3>
                  <ComentariosPanel tipo="colaborador" id={colab.id} enabled={open} />
                </div>
              )}
              <HistoricoSection colab={colab} mobPeriodos={mobPeriodos} obras={obras} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
      <EmployeeFormDialog open={editOpen} onClose={() => setEditOpen(false)} editData={colab} />
    </Dialog>
  );
};

export default EmployeeProfileDialog;
