export function filterAdminClasses(classes, { search = "", programId = "" } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return classes.filter(item => (!programId || String(item.program_id ?? item.program?.id) === String(programId))
    && (!query || [item.subject_name, item.section, item.instructor?.name, item.instructor?.email, item.program?.program_name]
      .some(value => String(value ?? "").toLocaleLowerCase().includes(query))));
}
