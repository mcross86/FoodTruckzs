export const PLAN_GUEST_MODE_KEY = "foodtruckzs:plan-guest-mode";

export function setPlanGuestMode(enabled: boolean): void {
  if (typeof window === "undefined") return;

  if (enabled) {
    window.sessionStorage.setItem(PLAN_GUEST_MODE_KEY, "1");
    return;
  }

  window.sessionStorage.removeItem(PLAN_GUEST_MODE_KEY);
}

export function isPlanGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(PLAN_GUEST_MODE_KEY) === "1";
}
