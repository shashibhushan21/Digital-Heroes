export const ROLES = {
  subscriber: "subscriber",
  admin: "admin",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export function isAdmin(role: AppRole | null | undefined): boolean {
  return role === ROLES.admin;
}

export function isSubscriber(role: AppRole | null | undefined): boolean {
  return role === ROLES.subscriber;
}
