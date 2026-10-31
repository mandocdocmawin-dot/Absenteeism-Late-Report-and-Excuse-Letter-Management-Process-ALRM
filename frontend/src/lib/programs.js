export function isGeneralEducationProgram(program) {
  return String(program?.program_name || program?.programName || program?.name || "").trim().toLowerCase() === "general education";
}

export function getSelectablePrograms(programs = []) {
  return programs.filter(program => !isGeneralEducationProgram(program)).sort((left, right) => {
    const leftName = String(left?.program_name || left?.programName || left?.name || "");
    const rightName = String(right?.program_name || right?.programName || right?.name || "");
    return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
  });
}

export function programShortName(name) {
  const normalized = String(name || "").replace(/^Bachelor of Science\s+/i, "BS ")
    .replace(/^Bachelor of Arts\s+/i, "BA ").replace(/^Associate in\s+/i, "A ");
  const match = normalized.match(/^(BS|BA|A)\s+(?:in\s+)?(.+)$/i);
  if (!match) return normalized;
  const initials = match[2].split(/\s+/).filter(word => !["and", "in", "of"].includes(word.toLowerCase())).map(word => word[0]).join("");
  return `${match[1]}${initials}`.toUpperCase();
}
