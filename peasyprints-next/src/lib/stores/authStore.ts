import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { auth } from '@/lib/firebase/config';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User
} from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  verificationId: string | null;
  recaptchaReady: boolean;
  lastPhoneNumber?: string;
  setUser: (u: User | null) => void;
  clearError: () => void;
  initRecaptcha: (containerId: string) => void;
  sendOTP: (phone: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
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

    setUser: (u) => set((s) => { s.user = u; }),
    clearError: () => set((s) => { s.error = null; }),

    initRecaptcha: (containerId) => {
      if (typeof window === 'undefined') return;
      // @ts-ignore
      if (!window.recaptchaVerifier) {
        // @ts-ignore
        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
          size: 'invisible'
        });
        set((s) => { s.recaptchaReady = true; });
      }
    },

    sendOTP: async (phone) => {
      set((s) => { s.loading = true; s.error = null; s.lastPhoneNumber = phone; });
      try {
        // @ts-ignore
        const appVerifier = window.recaptchaVerifier as RecaptchaVerifier;
        const confirmation = await signInWithPhoneNumber(auth, phone, appVerifier);
        set((s) => { s.verificationId = confirmation.verificationId; s.loading = false; });
      } catch (e: any) {
        set((s) => { s.error = e.message || 'Failed to send OTP'; s.loading = false; });
      }
    },

    verifyOTP: async (code) => {
      const { verificationId } = get();
      if (!verificationId) return;
      set((s) => { s.loading = true; s.error = null; });
      try {
        const cred = PhoneAuthProvider.credential(verificationId, code);
        const res = await signInWithCredential(auth, cred);
        set((s) => { s.user = res.user; s.loading = false; s.verificationId = null; });
      } catch (e: any) {
        set((s) => { s.error = e.message || 'Invalid code'; s.loading = false; });
      }
    },

    loginWithEmail: async (email, password) => {
      set((s) => { s.loading = true; s.error = null; });
      try {
        const res = await signInWithEmailAndPassword(auth, email, password);
        set((s) => { s.user = res.user; s.loading = false; });
      } catch (e: any) {
        set((s) => { s.error = e.message || 'Login failed'; s.loading = false; });
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
  useAuthStore.getState().setUser(u);
});
