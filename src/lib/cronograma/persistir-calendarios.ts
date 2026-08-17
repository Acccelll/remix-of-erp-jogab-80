/** @module-kind io */
// Persiste os calendários parseados do MPP para uma obra (idempotente).
// Reescreve cronograma_calendarios + cronograma_calendario_excecoes da obra.

import {
  cronogramaCalendariosRepo,
  cronogramaCalendarioExcecoesRepo,
} from "@/lib/repositories/cronograma";
import type { MppCalendar } from "@/lib/cronograma/mpp";

export async function persistirCalendariosMpp(
  obraId: string,
  calendars: MppCalendar[],
  calendarUidPadrao: string | undefined,
): Promise<void> {
  if (!calendars || calendars.length === 0) return;

  await cronogramaCalendariosRepo.deleteByObra(obraId);

  const payload = calendars.map((c) => ({
    obra_id: obraId,
    uid_mpp: c.uid,
    nome: c.nome ?? null,
    dias_uteis: c.diasUteis,
    horas_por_dia: c.horasPorDia,
    is_padrao: calendarUidPadrao ? c.uid === calendarUidPadrao : false,
  }));
  const inseridos = await cronogramaCalendariosRepo.insertReturningIds(payload);

  const byUid = new Map(inseridos.map((r) => [String(r.uid_mpp), r.id]));
  const excPayload: any[] = [];
  for (const c of calendars) {
    const calId = byUid.get(String(c.uid));
    if (!calId) continue;
    for (const ex of c.excecoes ?? []) {
      excPayload.push({
        calendario_id: calId,
        data_inicio: ex.dataInicio,
        data_fim: ex.dataFim,
        trabalha: ex.trabalha,
        nome: ex.nome ?? null,
      });
    }
  }
  await cronogramaCalendarioExcecoesRepo.insertMany(excPayload);
}
