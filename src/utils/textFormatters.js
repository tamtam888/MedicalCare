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
    .map(
      word => word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
};
