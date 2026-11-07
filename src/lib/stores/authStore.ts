import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { auth, db } from '@/lib/firebase/config';
import {
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
  initialized: boolean;
  setUser: (u: User | null) => void;
  clearError: () => void;
  setInitialized: (v: boolean) => void;
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
    initialized: false,

    setUser: (u) => set((s) => { s.user = u; }),
    clearError: () => set((s) => { s.error = null; }),
    setInitialized: (v) => set((s) => { s.initialized = v; }),

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
      set((s) => { s.user = null; });
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
