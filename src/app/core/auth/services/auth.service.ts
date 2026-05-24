import { inject, Injectable, signal } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  EmailAuthProvider,
  User as FirebaseUser,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { LoggerService } from '../../logging/logger.service';
import { AppUser, UserRole } from '../../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);

  readonly currentUser = signal<AppUser | null>(null);
  readonly isLoading = signal(true);

  constructor() {
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      if (firebaseUser) {
        const appUser = await this.loadUserProfile(firebaseUser);
        this.currentUser.set(appUser);
      } else {
        this.currentUser.set(null);
      }
      this.isLoading.set(false);
    });
  }

  currentUserId(): string {
    return this.auth.currentUser?.uid ?? '';
  }

  currentTenantId(): string {
    return this.currentUser()?.tenantId ?? this.auth.currentUser?.uid ?? '';
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  hasRole(...roles: UserRole[]): boolean {
    const role = this.currentUser()?.role;
    return role ? roles.includes(role) : false;
  }

  async login(email: string, password: string, rememberMe = false): Promise<void> {
    await setPersistence(this.auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    const user = await this.loadUserProfile(cred.user);
    this.currentUser.set(user);
    await this.router.navigate(['/dashboard']);
  }

  formatDisplayName(name: string): string {
    return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    const formattedName = this.formatDisplayName(displayName);
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(cred.user, { displayName: formattedName });
    const newUser: AppUser = {
      id: cred.user.uid,
      tenantId: cred.user.uid,
      email,
      displayName: formattedName,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
    };
    await setDoc(doc(this.firestore, 'users', cred.user.uid), newUser);
    this.currentUser.set(newUser);
    try { await sendEmailVerification(cred.user); } catch { /* kullanıcı verify-email sayfasından tekrar gönderebilir */ }
    await this.router.navigate(['/verify-email']);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async updateDisplayName(displayName: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Kullanıcı bulunamadı');
    const formatted = this.formatDisplayName(displayName);
    await updateProfile(user, { displayName: formatted });
    await setDoc(doc(this.firestore, 'users', user.uid), { displayName: formatted }, { merge: true });
    this.currentUser.update(u => u ? { ...u, displayName: formatted } : null);
  }

  async reloadUser(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Kullanıcı bulunamadı');
    await user.reload();
  }

  isEmailVerified(): boolean {
    return this.auth.currentUser?.emailVerified ?? false;
  }

  async resendVerificationEmail(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Kullanıcı bulunamadı');
    await sendEmailVerification(user);
  }

  async updateEmail(currentPassword: string, newEmail: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) throw new Error('Kullanıcı bulunamadı');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await verifyBeforeUpdateEmail(user, newEmail);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) throw new Error('Kullanıcı bulunamadı');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.currentUser.set(null);
    await this.router.navigate(['/auth/login']);
  }

  private async loadUserProfile(firebaseUser: FirebaseUser): Promise<AppUser> {
    try {
      const snap = await getDoc(doc(this.firestore, 'users', firebaseUser.uid));
      if (snap.exists()) {
        const data = snap.data() as AppUser;
        if (firebaseUser.email && firebaseUser.email !== data.email) {
          await setDoc(doc(this.firestore, 'users', firebaseUser.uid), { email: firebaseUser.email }, { merge: true });
          data.email = firebaseUser.email;
        }
        return { ...data, id: snap.id, role: data.role ?? 'admin' } as AppUser;
      }
    } catch (err) {
      this.logger.error('Failed to load user profile', err);
    }
    const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Kullanıcı';
    return {
      id: firebaseUser.uid,
      tenantId: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      displayName,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
    };
  }
}
