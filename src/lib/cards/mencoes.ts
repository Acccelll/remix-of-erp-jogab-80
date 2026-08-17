/** @module-kind pure */
/**
 * Parsing puro de @menções em texto de comentário.
 * Captura `@login` (a-z, 0-9, ponto, hífen, underscore). Case-insensitive.
 * Retorna logins normalizados em minúsculo, sem duplicatas, na ordem de aparição.
 */
const RE_MENCAO = /(^|[^a-zA-Z0-9._-])@([a-zA-Z0-9._-]+)/g;

export function extrairMencoes(texto: string): string[] {
  if (!texto) return [];
  const vistos = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  RE_MENCAO.lastIndex = 0;
  while ((m = RE_MENCAO.exec(texto)) !== null) {
    const login = m[2].toLowerCase();
    if (!vistos.has(login)) {
      vistos.add(login);
      out.push(login);
    }
  }
  return out;
}

/**
 * Token de menção em curso na posição do cursor (para autocomplete).
 * Retorna null se o caractere imediatamente antes do cursor não fizer parte
 * de uma menção ativa (`@xxx` sem espaço quebrando).
 */
export function mencaoEmCurso(
  texto: string,
  cursor: number,
): { inicio: number; query: string } | null {
  const head = texto.slice(0, cursor);
  const m = head.match(/(?:^|[^a-zA-Z0-9._-])@([a-zA-Z0-9._-]*)$/);
  if (!m) return null;
  const query = m[1] ?? "";
  const inicio = cursor - query.length - 1; // posição do `@`
  return { inicio, query: query.toLowerCase() };
}

export function aplicarMencao(
  texto: string,
  cursor: number,
  login: string,
): { texto: string; cursor: number } {
  const ctx = mencaoEmCurso(texto, cursor);
  if (!ctx) return { texto, cursor };
  const antes = texto.slice(0, ctx.inicio);
  const depois = texto.slice(cursor);
  const inserido = `@${login} `;
  return { texto: antes + inserido + depois, cursor: antes.length + inserido.length };
}
