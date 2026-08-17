/** @module-kind pure */
/**
 * Helpers para UUIDs canônicos. Usados para gatear queries que
 * enviam `currentPlayer.id` como filtro em colunas UUID no Supabase.
 * Em ambientes híbridos (backend PHP com IDs numéricos + Supabase UUID),
 * evita 400 Bad Request quando o ID do usuário atual não é um UUID.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function uuidOrNull(value: unknown): string | null {
  return isUuid(value) ? value : null;
}

export function requireUuid(value: unknown, label = "value"): string {
  if (!isUuid(value)) {
    throw new Error(`${label} não é um UUID válido`);
  }
  return value;
}
