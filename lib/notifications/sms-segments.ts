/** GSM 03.38 default/extension alphabets; no smart encoding or transliteration.
 * Unicode uses UTF-16 units (70 single / 67 concatenated), including surrogate pairs.
 * A metered adapter must preserve this encoding/UDH contract and idempotency key.
 */
const gsm = new Set(Array.from("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"));
const extension = new Set(Array.from("\f^{}\\[~]|€"));
export function smsSegments(body: string) {
  let units = 0;
  let encoding: "GSM-7" | "UTF-16" = "GSM-7";
  for (const character of body) {
    if (gsm.has(character)) units++;
    else if (extension.has(character)) units += 2;
    else { encoding = "UTF-16"; units = body.length; break; }
  }
  const single = encoding === "GSM-7" ? 160 : 70;
  const concatenated = encoding === "GSM-7" ? 153 : 67;
  if (units <= single) return { encoding, units, segments: units === 0 ? 0 : 1 };
  // Do not split an extension escape or a Unicode surrogate pair across parts.
  let segments = 1, used = 0;
  for (const character of body) {
    const size = encoding === "GSM-7" ? extension.has(character) ? 2 : 1 : character.length;
    if (used + size > concatenated) { segments++; used = 0; }
    used += size;
  }
  return { encoding, units, segments };
}
