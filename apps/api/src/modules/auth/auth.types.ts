export const GLOBAL_ROLES = ["customer", "vendor_user", "platform_admin", "support_admin"] as const;

export const VENDOR_ROLES = ["owner", "manager", "staff", "viewer"] as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[number];
export type VendorRole = (typeof VENDOR_ROLES)[number];

export type UserSummary = {
  email: string;
  firstName: string;
  globalRoles: GlobalRole[];
  id: string;
  lastName: string;
  phone?: string;
  status: "pending_verification" | "active" | "suspended" | "disabled";
};

export type VendorApprovalStatus = "pending" | "approved" | "rejected";

export type VendorMembershipSummary = {
  approvalStatus: VendorApprovalStatus;
  businessName: string;
  role: VendorRole;
  status: "active" | "invited" | "suspended" | "removed";
  vendorId: string;
};

export type AuthTokens = {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type AuthResponse = {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  user: UserSummary;
  vendorMemberships: VendorMembershipSummary[];
};

export type AuthServiceResult = AuthResponse & {
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};
