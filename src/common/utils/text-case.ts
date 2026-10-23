// Muchos vendedores escriben nombres y descripciones TODO EN MAYÚSCULAS.
// Google Merchant Center los rechaza ("uso excesivo de mayúsculas") y en los
// resultados de búsqueda se ven como spam, así que se normalizan para el feed.

const LOWERCASE_WORDS = new Set(['a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'o', 'para', 'por', 'sin', 'un', 'una', 'y', 'x']);

// Siglas que se dejan en mayúsculas (tallas, tecnología, unidades).
const ACRONYMS = new Set([
  'tv', 'led', 'lcd', 'oled', 'qled', 'usb', 'hd', 'uhd', 'fhd', 'hdmi', 'ssd', 'hdd', 'ram', 'pc', 'cpu', 'gpu', 'wifi',
  'gb', 'tb', 'mb', 'mah', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'uv', 'ac', 'dc', 'bt', 'nfc', 'gps', 'diy',
]);

/** true si al menos el 70% de las letras son mayúsculas (y hay suficientes para juzgar). */
export function isMostlyUppercase(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 4) return false;
  const upper = letters.filter((c) => c !== c.toLowerCase()).length;
  return upper / letters.length >= 0.7;
}

/**
 * "IMPRESORA EPSON L3210 DE TINTA" -> "Impresora Epson L3210 de Tinta".
 * Las palabras con dígitos (modelos, referencias: L3210, 4K, USB3) se dejan
 * tal cual. Si el texto no está mayormente en mayúsculas, no se toca.
 */
export function normalizeTitleCase(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!isMostlyUppercase(clean)) return clean;
  return clean
    .split(' ')
    .map((word, i) => {
      if (/\d/.test(word)) return word;
      const lower = word.toLocaleLowerCase('es-CO');
      if (ACRONYMS.has(lower.replace(/\P{L}/gu, ''))) return word;
      if (i > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.replace(/^(\P{L}*)(\p{L})/u, (_, prefix: string, first: string) => prefix + first.toLocaleUpperCase('es-CO'));
    })
    .join(' ');
}

/** "IMPRIME. COPIA Y ESCANEA" -> "Imprime. Copia y escanea". */
export function normalizeSentenceCase(text: string): string {
  if (!isMostlyUppercase(text)) return text;
  return text
    .toLocaleLowerCase('es-CO')
    .replace(/(^|[.!?¡¿]\s+|\n\s*)(\p{L})/gu, (_, sep: string, first: string) => sep + first.toLocaleUpperCase('es-CO'));
}
