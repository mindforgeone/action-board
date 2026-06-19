import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { auth, firebaseConfigured } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      setError("Firebase не настроен. Заполните .env и перезапустите проект.");
      return;
    }

    setError("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider).catch((authError: unknown) => {
      const message = authError instanceof Error ? authError.message : "Не удалось войти.";
      setError(message);
    });
  }, []);

  const logOut = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
  }, []);

  return {
    user,
    loading,
    error,
    signInWithGoogle,
    logOut,
    firebaseConfigured,
  };
}
