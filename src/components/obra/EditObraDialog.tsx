import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useClientes } from "@/hooks/crm/useClientes";
import { obrasRepo } from "@/lib/repositories/obras";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validateObra, type ObraFormErrors } from "@/lib/schemas/obra";
import { ObraFormFields, obraToFormState, buildObraPayload } from "./ObraFormFields";

/**
 * Diálogo único de edição de obra, reutilizado em FinObras
 * (lista) e FinObraDetalhe (botão "Editar obra" no header).
 */
export function EditObraDialog({
  obra,
  open,
  onOpenChange,
  onSaved,
}: {
  obra: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<ObraFormErrors>({});
  const [saving, setSaving] = useState(false);

  const { data: clientes } = useClientes({ enabled: open });

  useEffect(() => {
    if (obra && open) {
      setForm(obraToFormState(obra));
      setErrors({});
    }
  }, [obra, open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!obra || saving) return;
    const v = validateObra(form);
    if (!v.ok) {
      setErrors(v.errors);
      toast.error("Verifique os campos destacados");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      try {
        await obrasRepo.update(obra.id, buildObraPayload(form));
        toast.success("Obra atualizada");
        onOpenChange(false);
        qc.invalidateQueries({ queryKey: ["obras"] });
        qc.invalidateQueries({ queryKey: ["obra", obra.id] });
        onSaved?.();
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao salvar obra");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar obra</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3" noValidate>
          <ObraFormFields
            state={form}
            setState={setForm}
            errors={errors}
            clientes={clientes ?? []}
            isEdit
          />
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={saving}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
