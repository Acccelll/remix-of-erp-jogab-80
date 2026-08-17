/** @module-kind io */
export const loadLocal = <T>(key: string, fallback: T): T => {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : fallback;
  } catch {
    return fallback;
  }
};
