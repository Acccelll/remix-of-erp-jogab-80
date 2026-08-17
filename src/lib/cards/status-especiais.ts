/** @module-kind pure */
export const SPECIAL_STATUS = new Set([
  "__folga__",
  "__afastamento__",
  "__ferias__",
  "folga",
  "afastamento",
  "ferias",
]);

export const isSpecialStatus = (statusId: string | null): boolean => {
  if (!statusId) return false;
  return SPECIAL_STATUS.has(statusId);
};
