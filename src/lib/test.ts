import { normalizeText, normalizeTextArea, normalizeNumberString, normalizeToArabicNumber, normalizeForCompare } from './normalization';
console.log(normalizeText('  CO2   emission \u200B ')); // Output: "สวัสดี โลก"atch
console.log(normalizeTextArea('  CO2   emission \n\n\n\n  ')); // Output: "สวัสดี โลก"
console.log(normalizeNumberString('  ๑,๒๓๔.๕๖  '));
console.log(normalizeToArabicNumber('  ๑,๒๓๔.๕๖  '));
console.log(normalizeToArabicNumber('abc')); // Output: null
console.log(normalizeForCompare('  Methane')); // Output: "สวัสดี โลก"