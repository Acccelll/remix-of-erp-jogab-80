import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFuncoesContext } from "@/contexts/FuncoesContext";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import DatePickerField from "@/components/common/DatePickerField";
import { Colaborador } from "@/types";
import { maskCPF, cleanCPF } from "@/lib/utils";
import { fetchCep, formatEndereco } from "@/lib/core/cep";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { validateColaborador } from "@/lib/schemas/colaborador";
import CampoValidadorPix from "@/components/CampoValidadorPix";

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: Colaborador | null;
}

const empty = {
  matricula: "",
  nome: "",
  genero: "",
  cep: "",
  endereco: "",
  dataNascimento: "",
  cidade: "",
  uf: "",
  etnia: "",
  estadoCivil: "",
  nomeConjuge: "",
  nomeMae: "",
  nomePai: "",
  nacionalidade: "Brasileiro",
  rg: "",
  dataEmissaoRG: "",
  orgaoEmissorRG: "",
  ufEmissorRG: "",
  cpf: "",
  dataEmissaoCPF: "",
  pis: "",
  dataEmissaoPIS: "",
  dataAdmissao: "",
  funcao: "",
  salario: "",
  formaSalario: "mensal" as "mensal" | "horista",
  ativo: true,
  obraAtualId: null as string | null,
  banco: "",
  numeroBanco: "",
  agencia: "",
  numeroConta: "",
  tipoConta: "",
  tipoChavePix: "",
  chavePix: "",
};

const EmployeeFormDialog: React.FC<Props> = ({ open, onClose, editData }) => {
  const { addColaborador, updateColaborador, colaboradores } = useColaboradoresContext();
  const { funcoes } = useFuncoesContext();
  const [form, setForm] = useState(empty);
  const activeFuncoes = funcoes.filter((f) => f.ativa);
  const isEditing = !!editData;

  useEffect(() => {
    if (open && editData) {
      setForm({
        matricula: editData.matricula,
        nome: editData.nome,
        genero: editData.genero,
        cep: editData.cep,
        endereco: editData.endereco,
        dataNascimento: editData.dataNascimento,
        cidade: editData.cidade,
        uf: editData.uf ?? "",
        etnia: editData.etnia,
        estadoCivil: editData.estadoCivil,
        nomeConjuge: editData.nomeConjuge,
        nomeMae: editData.nomeMae,
        nomePai: editData.nomePai,
        nacionalidade: editData.nacionalidade,
        rg: editData.rg,
        dataEmissaoRG: editData.dataEmissaoRG,
        orgaoEmissorRG: editData.orgaoEmissorRG,
        ufEmissorRG: editData.ufEmissorRG,
        cpf: cleanCPF(editData.cpf),
        dataEmissaoCPF: editData.dataEmissaoCPF || "",
        pis: editData.pis,
        dataEmissaoPIS: editData.dataEmissaoPIS || "",
        dataAdmissao: editData.dataAdmissao,
        funcao: editData.funcao,
        salario: editData.salario,
        formaSalario: editData.formaSalario as "mensal" | "horista",
        ativo: editData.ativo,
        obraAtualId: editData.obraAtualId,
        banco: editData.banco || "",
        numeroBanco: editData.numeroBanco || "",
        agencia: editData.agencia || "",
        numeroConta: editData.numeroConta || "",
        tipoConta: editData.tipoConta || "",
        tipoChavePix: editData.tipoChavePix || "",
        chavePix: editData.chavePix || "",
      });
    } else if (open) {
      setForm(empty);
    }
  }, [open, editData]);

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const [cpfError, setCpfError] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);

  const handleBuscarCep = async () => {
    if (loadingCep) return;
    setLoadingCep(true);
    try {
      const r = await fetchCep(form.cep);
      if (!r) {
        toast.error("CEP não encontrado. Verifique o número (8 dígitos).");
        return;
      }
      const enderecoRua = [r.logradouro, r.bairro].filter(Boolean).join(", ");
      // Cidade e UF vão em campos separados. Concatenar em "Cidade/UF" — como
      // era feito antes — quebrava a geolocalização do mapa de logística, que
      // procura o nome do município tal como o IBGE o registra.
      setForm((p) => ({
        ...p,
        endereco: enderecoRua,
        cidade: r.localidade || p.cidade,
        uf: r.uf || p.uf,
      }));
      toast.success("Endereço preenchido pelo ViaCEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateColaborador(form, {
      colaboradores,
      editingId: isEditing ? editData?.id : null,
    });
    if (!validation.ok) {
      setCpfError(
        validation.errors.cpf ?? validation.errors.matricula ?? validation.errors.nome ?? "",
      );
      return;
    }
    setCpfError("");
    if (isEditing) {
      updateColaborador(editData.id, form);
    } else {
      addColaborador(form);
    }
    setForm(empty);
    onClose();
  };

  const renderField = (label: string, field: string, type = "text", span = 1) => (
    <div key={field} className={span === 2 ? "col-span-2" : ""}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {type === "date" ? (
        <DatePickerField
          value={(form as any)[field] || ""}
          onChange={(v) => set(field, v)}
          className="mt-1"
        />
      ) : (
        <Input
          type={type}
          value={(form as any)[field] || ""}
          onChange={(e) => set(field, e.target.value)}
          className="mt-1"
        />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="font-display">
            {isEditing ? "Editar Colaborador" : "Cadastrar Colaborador"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 min-h-0 overflow-y-auto px-6">
            <div className="grid grid-cols-3 gap-3 pb-4">
              {renderField("Nº de Matrícula", "matricula")}
              {renderField("Nome do Funcionário", "nome", "text", 2)}
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Gênero</Label>
                <Select value={form.genero} onValueChange={(v) => set("genero", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">CEP</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={form.cep}
                    onChange={(e) => set("cep", e.target.value)}
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleBuscarCep}
                    disabled={loadingCep}
                    aria-label="Buscar endereço pelo CEP"
                    title="Buscar endereço pelo CEP"
                  >
                    {loadingCep ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {renderField("Endereço Completo", "endereco", "text", 2)}
              {renderField("Data de Nascimento", "dataNascimento", "date")}
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Cidade</Label>
                  <Input
                    value={form.cidade || ""}
                    onChange={(e) => set("cidade", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">UF</Label>
                  <Input
                    value={form.uf || ""}
                    onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))}
                    maxLength={2}
                    placeholder="SP"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Etnia</Label>
                <Select value={form.etnia} onValueChange={(v) => set("etnia", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Branco", "Preto", "Pardo", "Amarelo", "Indígena"].map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Estado Civil</Label>
                <Select value={form.estadoCivil} onValueChange={(v) => set("estadoCivil", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Solteiro", "Casado", "Divorciado", "Viúvo", "União Estável"].map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {renderField("Nome do Cônjuge", "nomeConjuge")}
              {renderField("Nome da Mãe", "nomeMae")}
              {renderField("Nome do Pai", "nomePai")}
              {renderField("Nacionalidade", "nacionalidade")}
              {renderField("RG", "rg")}
              {renderField("Data de Emissão do RG", "dataEmissaoRG", "date")}
              {renderField("Órgão Emissor do RG", "orgaoEmissorRG")}
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  UF Emissor do RG
                </Label>
                <Select value={form.ufEmissorRG} onValueChange={(v) => set("ufEmissorRG", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "AC",
                      "AL",
                      "AP",
                      "AM",
                      "BA",
                      "CE",
                      "DF",
                      "ES",
                      "GO",
                      "MA",
                      "MT",
                      "MS",
                      "MG",
                      "PA",
                      "PB",
                      "PR",
                      "PE",
                      "PI",
                      "RJ",
                      "RN",
                      "RS",
                      "RO",
                      "RR",
                      "SC",
                      "SP",
                      "SE",
                      "TO",
                    ].map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  CPF <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={maskCPF(form.cpf)}
                  onChange={(e) => {
                    set("cpf", cleanCPF(e.target.value));
                    setCpfError("");
                  }}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                  className={`mt-1 ${cpfError ? "border-destructive" : ""}`}
                />
                {cpfError && <p className="text-xs text-destructive mt-1">{cpfError}</p>}
              </div>
              {renderField("Data de Emissão do CPF", "dataEmissaoCPF", "date")}
              {renderField("PIS", "pis")}
              {renderField("Data de Emissão de PIS", "dataEmissaoPIS", "date")}
              {renderField("Data de Admissão", "dataAdmissao", "date")}
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Função</Label>
                <Select value={form.funcao} onValueChange={(v) => set("funcao", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeFuncoes.map((f) => (
                      <SelectItem key={f.id} value={f.nome}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {renderField("Salário", "salario")}
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Forma de Salário
                </Label>
                <RadioGroup
                  value={form.formaSalario}
                  onValueChange={(v) => set("formaSalario", v)}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="mensal" id="mensal" />
                    <Label htmlFor="mensal" className="text-sm">
                      Mensal
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="horista" id="horista" />
                    <Label htmlFor="horista" className="text-sm">
                      Horista
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="col-span-3 mt-2">
                <h3 className="text-sm font-semibold mb-2">Dados Bancários</h3>
              </div>
              {renderField("Banco", "banco")}
              {renderField("Nº do Banco", "numeroBanco")}
              {renderField("Agência", "agencia")}
              {renderField("Nº da Conta", "numeroConta")}
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Tipo da Conta</Label>
                <Select value={form.tipoConta} onValueChange={(v) => set("tipoConta", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Conta Corrente">Conta Corrente</SelectItem>
                    <SelectItem value="Conta Salário">Conta Salário</SelectItem>
                    <SelectItem value="Conta Poupança">Conta Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Tipo da Chave Pix
                </Label>
                <Select value={form.tipoChavePix} onValueChange={(v) => set("tipoChavePix", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Chave aleatória">Chave aleatória</SelectItem>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="Celular">Celular</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <CampoValidadorPix
                  value={form.chavePix}
                  onChange={(v) => set("chavePix", v)}
                  tipoChave={form.tipoChavePix}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{isEditing ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeFormDialog;
