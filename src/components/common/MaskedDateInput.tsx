// Compat: MaskedDateInput foi substituído pelo DatePickerField (mesma API —
// value/onChange no formato ISO "YYYY-MM-DD", exibição DD/MM/AAAA).
// Mantido apenas como re-export para não quebrar imports antigos.
export { DatePickerField as default } from "./DatePickerField";
