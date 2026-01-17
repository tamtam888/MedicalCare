export const capitalizeFirstLetter = (text = "") => {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const capitalizeWords = (text = "") => {
  if (!text) return "";
  return text
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const isProbablyId = (text = "") => {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const digits = raw.replace(/\D/g, "");
  const allDigits = digits.length === raw.length;
  return allDigits || digits.length >= 5;
};
export const capitalizeSentences = (text = "") => {
  const raw = String(text ?? "");
  if (!raw.trim()) return raw;

  const lower = raw.toLowerCase();

  return lower.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (match) => match.toUpperCase());
};
