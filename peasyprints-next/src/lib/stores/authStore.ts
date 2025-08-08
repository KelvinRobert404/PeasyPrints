import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { auth, db } from '@/lib/firebase/config';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  verificationId: string | null;
  recaptchaReady: boolean;
  lastPhoneNumber?: string;
  initialized: boolean;
  // Recaptcha management
  activeRecaptchaId?: string;
  recaptchaMap: Record<string, RecaptchaVerifier>;
  authFlow: 'login' | 'register' | null;
  registrationUsername?: string;
  setUser: (u: User | null) => void;
  clearError: () => void;
  setInitialized: (v: boolean) => void;
  initRecaptcha: (containerId: string, size?: 'invisible' | 'normal') => void;
  resetRecaptcha: (containerId: string) => void;
  sendOTP: (phone: string) => Promise<void>;
  startPhoneLogin: (phone: string) => Promise<void>;
  startPhoneRegistration: (username: string, phone: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, username: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  immer((set, get) => ({
    user: null,
    loading: false,
    error: null,
    verificationId: null,
    recaptchaReady: false,
    lastPhoneNumber: undefined,
    initialized: false,
    activeRecaptchaId: undefined,
    recaptchaMap: {},
    authFlow: null,
    registrationUsername: undefined,

    setUser: (u) => set((s) => { s.user = u; }),
    clearError: () => set((s) => { s.error = null; }),
    setInitialized: (v) => set((s) => { s.initialized = v; }),

    initRecaptcha: (containerId, size = 'invisible') => {
      if (typeof window === 'undefined') return;
      const state = get();
      const existing = state.recaptchaMap[containerId];
      if (existing) {
        try { existing.clear(); } catch {}
      }
      const verifier = new RecaptchaVerifier(auth, containerId, { size });
      // Ensure widget is rendered to obtain a fresh token when needed
      try { void verifier.render(); } catch {}
      set((s) => {
        s.recaptchaMap[containerId] = verifier;
        s.activeRecaptchaId = containerId;
        s.recaptchaReady = true;
      });
    },

    resetRecaptcha: (containerId) => {
      const existing = get().recaptchaMap[containerId];
      if (existing) {
        try { existing.clear(); } catch {}
      }
      set((s) => {
        delete s.recaptchaMap[containerId];
        if (s.activeRecaptchaId === containerId) s.activeRecaptchaId = undefined;
        s.recaptchaReady = false;
      });
    },

    sendOTP: async (phone) => {
      set((s) => { s.loading = true; s.error = null; s.lastPhoneNumber = phone; });
      try {
        const { activeRecaptchaId, recaptchaMap } = get();
        const appVerifier = activeRecaptchaId ? recaptchaMap[activeRecaptchaId] : undefined;
        if (!appVerifier) throw new Error('reCAPTCHA not ready');
        // Ensure token by explicitly verifying (shows widget if size='normal')
        try {
          await appVerifier.verify();
        } catch (ve: any) {
          throw ve;
        }
        const confirmation = await signInWithPhoneNumber(auth, phone, appVerifier);
        set((s) => { s.verificationId = confirmation.verificationId; s.loading = false; });
      } catch (e: any) {
        const msg = e?.message || 'Failed to send OTP';
        // Refresh verifier on credential errors so user can retry
        const code: string | undefined = e?.code;
        const { activeRecaptchaId } = get();
        if (activeRecaptchaId && (msg.includes('app-credential') || msg.includes('captcha') || code === 'auth/invalid-app-credential' || code === 'auth/captcha-check-failed')) {
          try { get().resetRecaptcha(activeRecaptchaId); } catch {}
          // Re-init immediately with visible widget to allow user interaction
          try { get().initRecaptcha(activeRecaptchaId, 'normal'); } catch {}
        }
        set((s) => { s.error = code === 'auth/captcha-check-failed' ? 'Please complete the CAPTCHA then try again.' : msg; s.loading = false; });
      }
    },

    startPhoneLogin: async (phone) => {
      set((s) => { s.authFlow = 'login'; s.registrationUsername = undefined; });
      await get().sendOTP(phone);
    },

    startPhoneRegistration: async (username, phone) => {
      set((s) => { s.authFlow = 'register'; s.registrationUsername = username; });
      await get().sendOTP(phone);
    },

    verifyOTP: async (code) => {
      const { verificationId } = get();
      if (!verificationId) return;
      set((s) => { s.loading = true; s.error = null; });
      try {
        const cred = PhoneAuthProvider.credential(verificationId, code);
        const res = await signInWithCredential(auth, cred);
        const { authFlow, registrationUsername } = get();
        if (authFlow === 'register') {
          const created = await upsertUserWithRegister(res.user, registrationUsername || null);
          if (!created) {
            set((s) => { s.error = 'Phone number already registered'; });
          }
        } else {
          const exists = await userDocExists(res.user.uid);
          if (!exists) {
            set((s) => { s.error = 'User not found. Please register first.'; });
          }
        }
        set((s) => { s.user = res.user; s.loading = false; s.verificationId = null; s.authFlow = null; s.registrationUsername = undefined; });
      } catch (e: any) {
        set((s) => { s.error = e.message || 'Invalid code'; s.loading = false; });
      }
    },

    loginWithEmail: async (email, password) => {
      set((s) => { s.loading = true; s.error = null; });
      try {
        const res = await signInWithEmailAndPassword(auth, email, password);
        const exists = await userDocExists(res.user.uid);
        if (!exists) {
          set((s) => { s.error = 'User not found. Please register first.'; s.loading = false; });
          return;
        }
        set((s) => { s.user = res.user; s.loading = false; });
      } catch (e: any) {
        set((s) => { s.error = e.message || 'Login failed'; s.loading = false; });
      }
    },

    registerWithEmail: async (email, password, username) => {
      set((s) => { s.loading = true; s.error = null; });
      try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await upsertUserWithRegister(res.user, username || null);
        set((s) => { s.user = res.user; s.loading = false; });
      } catch (e: any) {
        set((s) => { s.error = e.message || 'Registration failed'; s.loading = false; });
      }
    },

    sendPasswordReset: async (email) => {
      set((s) => { s.loading = true; s.error = null; });
      try {
        await sendPasswordResetEmail(auth, email);
        set((s) => { s.loading = false; });
      } catch (e: any) {
        set((s) => { s.error = e.message || 'Failed to send reset email'; s.loading = false; });
      }
    },

    logout: async () => {
      await auth.signOut();
      set((s) => { s.user = null; s.verificationId = null; });
    }
  }))
);

// Auth subscription helper
onAuthStateChanged(auth, (u) => {
  const { setUser, setInitialized } = useAuthStore.getState();
  setUser(u);
  setInitialized(true);
});

async function userDocExists(uid: string): Promise<boolean> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists();
}

// Register-like upsert to mirror Flutter _processAfterSignIn logic
async function upsertUserWithRegister(user: User, username: string | null): Promise<boolean> {
  const ref = doc(db, 'users', user.uid);
  const exists = await userDocExists(user.uid);
  if (username != null) {
    if (!exists) {
      const payload: any = {
        username,
        phoneNumber: user.phoneNumber || null,
        email: user.email || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(ref, payload, { merge: true });
      return true;
    } else {
      return false; // already registered
    }
  } else {
    // login path; simply ensure doc exists (no creation)
    return exists;
  }
}
