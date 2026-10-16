// Roles belong to the selected farm, not the user's other workspaces.
export function canManageFarm(role: string | undefined): boolean {
  return role === 'MANAGER' || role === 'SUPER_ADMIN';
}
