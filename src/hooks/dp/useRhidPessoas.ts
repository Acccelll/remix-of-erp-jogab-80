// Cadastro de pessoas da RHiD, sem apuração — base da Conciliação de Cadastro.
//
// Fica desligado por padrão: cada consulta bate na API externa (login + /person
// + /department), e a tela só precisa disso quando o operador pede.
import { useQuery } from "@tanstack/react-query";
import { rhidRepo } from "@/lib/repositories/rhid";
import { queryKey } from "@/lib/query-keys";
import { hojeBrasilia } from "@/lib/core/date";

export function useRhidPessoas(ativo: boolean) {
  return useQuery({
    queryKey: queryKey("rhid_pessoas"),
    // O período não filtra o cadastro, mas a edge function exige datas válidas.
    queryFn: () => rhidRepo.listarPessoas({ dataIni: hojeBrasilia(), dataFinal: hojeBrasilia() }),
    enabled: ativo,
    retry: false,
    staleTime: 5 * 60_000,
  });
}
