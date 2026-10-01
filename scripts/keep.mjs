// A veto over the label step, in plain code.
// Triage proposes what is junk; this list refuses to let go of anything that
// documents money or responsibility — damage, a deposit, a claim, a fine.
// It costs a kept email now and then. The opposite mistake costs a lost document.

export const KEEP_WORDS = [
  // English
  "damage", "claim", "deposit", "dispute", "chargeback", "liability",
  "penalty", "warranty", "insurance", "invoice", "police report", "case number",
  // Russian
  "ущерб", "повреждени", "претензи", "рекламаци", "депозит", "залог",
  "штраф", "страхов", "гарантийн", "удержани", "возврат средств",
  "спорн", "номер дела", "акт приём", "акт прием",
  // Spanish
  "daño", "fianza", "reclamaci", "multa", "garantía",
];

/** The first word from the list found in the text, or null. */
export function keepReason(text, words = KEEP_WORDS) {
  const hay = (text || "").toLowerCase();
  return words.find((w) => hay.includes(w)) || null;
}
