// Avatar initials: the first letters of the first two words ("La Reina" → "LR"), or the first two
// letters of a one-word name ("Paco" → "PA").
export const initialsOf = (name: string) => {
  const words = name.split(/[\s_-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return [...words[0]].slice(0, 2).join("").toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => [...word][0].toUpperCase())
    .join("");
};
