export function mergeUsersPageSuccess(current, result, usersKey) {
  return { ...current, users: result.data, usersKey, meta: result.meta, loadingUsers: false, error: "" };
}

export function mergeProgramsSuccess(current, programs) {
  return { ...current, programs, loadingPrograms: false, programError: "" };
}

export function recoverUserManagementPage(page, meta) {
  const lastPage = Number(meta?.last_page);
  return Number.isInteger(lastPage) && lastPage >= 1 && page > lastPage ? lastPage : null;
}
