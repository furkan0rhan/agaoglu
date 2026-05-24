export type UserRole = 'admin' | 'cashier' | 'staff';

export interface AppUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
}
