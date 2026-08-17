import { useCallback, useEffect, useRef, useState } from "react";
import { cleanCPF, isValidCPF } from "@/lib/utils";

export type ValidadorState =
  | "nao_iniciado"
  | "validando"
  | "valido"
  | "aviso"
  | "invalido"
  | "desabilitado";

export interface ValidacaoResult {
  state: ValidadorState;
  mensagem: string;
  detalhe?: string;
  titular?: string;
  banco?: string;
}

type TipoChave = "CPF" | "Email" | "Celular" | "Chave aleatória" | string;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validaFormato(chave: string, tipo: TipoChave): { ok: boolean; motivo?: string } {
  const v = chave.trim();
  if (!v) return { ok: false, motivo: "Digite uma chave Pix" };
  switch (tipo) {
    case "CPF": {
      const c = cleanCPF(v);
      if (c.length !== 11) return { ok: false, motivo: "CPF deve ter 11 dígitos" };
      if (!isValidCPF(c)) return { ok: false, motivo: "CPF inválido" };
      return { ok: true };
    }
    case "Email":
      return EMAIL_RE.test(v)
        ? { ok: true }
        : { ok: false, motivo: "Formato de e-mail inválido" };
    case "Celular": {
      const dig = v.replace(/\D/g, "");
      if (dig.length < 10 || dig.length > 13)
        return { ok: false, motivo: "Celular deve ter DDD + número" };
      return { ok: true };
    }
    case "Chave aleatória":
      return UUID_RE.test(v)
        ? { ok: true }
        : { ok: false, motivo: "Chave aleatória deve ser um UUID (36 caracteres)" };
    default:
      return { ok: false, motivo: "Selecione o tipo da chave Pix" };
  }
}

export function useValidadorPix(chavePix: string, tipoChave: TipoChave) {
  const [validacao, setValidacao] = useState<ValidacaoResult>({
    state: "nao_iniciado",
    mensagem: "Digite uma chave Pix para validar",
  });
  const abortRef = useRef<AbortController | null>(null);

  const validar = useCallback(async () => {
    if (!chavePix?.trim()) {
      setValidacao({ state: "nao_iniciado", mensagem: "Digite uma chave Pix para validar" });
      return;
    }
    if (!tipoChave) {
      setValidacao({ state: "nao_iniciado", mensagem: "Selecione o tipo da chave" });
      return;
    }

    const fmt = validaFormato(chavePix, tipoChave);
    if (!fmt.ok) {
      setValidacao({ state: "invalido", mensagem: fmt.motivo || "Formato inválido" });
      return;
    }

    // Só formato — validação com Banco Central via BrasilAPI não é pública para consulta DICT.
    // Consideramos "válida por formato".
    setValidacao({
      state: "valido",
      mensagem: "Chave Pix válida",
      detalhe: "Formato reconhecido para o tipo selecionado",
    });
  }, [chavePix, tipoChave]);

  useEffect(() => {
    const t = setTimeout(() => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      validar();
    }, 600);
    return () => clearTimeout(t);
  }, [chavePix, tipoChave, validar]);

  return { validacao, revalidar: validar };
}
