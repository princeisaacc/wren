"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";

export function authCode(err: unknown): string {
  return typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
}

// Turns Firebase error codes into plain sentences. An empty string means "say nothing".
export function authMessage(err: unknown): string {
  switch (authCode(err)) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in.";
    case "auth/weak-password":
      return "Use a stronger password of at least 8 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Allow pop-ups for this site and try again.";
    case "auth/requires-recent-login":
      return "For security, log out and log in again, then delete your account.";
    default:
      return "Something went wrong. Try again.";
  }
}

type AuthValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logInWithGoogle: () => Promise<{ isNew: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
  renameUser: (name: string) => Promise<void>;
  removeAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function useProfile() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const name = user?.displayName || email.split("@")[0] || "there";
  const initials =
    name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "W";
  return { name, email, initials };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      configured: firebaseConfigured,
      signUp: async (name, email, password) => {
        const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
        await updateProfile(cred.user, { displayName: name });
        setUser({ ...cred.user, displayName: name } as User);
      },
      logIn: async (email, password) => {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      },
      logInWithGoogle: async () => {
        const cred = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
        return { isNew: !!getAdditionalUserInfo(cred)?.isNewUser };
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(getFirebaseAuth(), email);
      },
      logOut: async () => {
        await signOut(getFirebaseAuth());
      },
      renameUser: async (name) => {
        const current = getFirebaseAuth().currentUser;
        if (!current) return;
        await updateProfile(current, { displayName: name });
        setUser({ ...current, displayName: name } as User);
      },
      removeAccount: async () => {
        const current = getFirebaseAuth().currentUser;
        if (current) await deleteUser(current);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Wrap any page that needs a signed-in user.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4 md:p-8" aria-busy="true" aria-label="Loading">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-softer" />
        <div className="h-24 animate-pulse rounded-xl bg-softer" />
        <div className="h-24 animate-pulse rounded-xl bg-softer" />
      </div>
    );
  }
  return <>{children}</>;
}
