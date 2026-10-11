import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UNDER_18_MESSAGE } from "@/lib/adult";
import type { User, Session } from "@supabase/supabase-js";

type SignUpResult =
  | { outcome: "error"; message: string }
  | { outcome: "confirm" }
  | { outcome: "signed_in" }
  | { outcome: "already_registered" };

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    birthYear: number,
    emailRedirectTo?: string,
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  // True after the user opens a password-recovery email link (Supabase fires
  // PASSWORD_RECOVERY and signs them in on a temporary session).
  passwordRecovery: boolean;
  updatePassword: (password: string) => Promise<string | null>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT") setPasswordRecovery(false);
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  // Supabase's signUp() behaves differently depending on project config:
  // - "confirm": account created, confirmation email sent (this project's
  //   setting — "Confirm email" is on).
  // - "signed_in": a session came back immediately (rare with confirm-email on).
  // - "already_registered": the email already has a CONFIRMED account.
  //   Supabase silently no-ops this (anti-enumeration) rather than erroring —
  //   detected from data.user.identities being empty.
  async function signUp(
    email: string,
    password: string,
    birthYear: number,
    emailRedirectTo?: string,
  ): Promise<SignUpResult> {
    // The handle_new_user trigger reads these (and rejects an under-18 year).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { birth_year: birthYear, is_adult_declared: true }, emailRedirectTo },
    });
    if (error) {
      // The trigger's rejection surfaces as a generic database error; the form
      // already blocks a declared under-18 year, so this is a backstop.
      const message = /database error/i.test(error.message)
        ? `We couldn't create your account. ${UNDER_18_MESSAGE} If you're 18 or older, try again.`
        : error.message;
      return { outcome: "error", message };
    }
    if (data.session) return { outcome: "signed_in" };
    if (data.user && data.user.identities?.length === 0) return { outcome: "already_registered" };
    return { outcome: "confirm" };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function resetPassword(email: string): Promise<string | null> {
    // The redirect URL must be in Supabase Auth -> URL Configuration -> Redirect URLs.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error?.message ?? null;
  }

  async function updatePassword(password: string): Promise<string | null> {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setPasswordRecovery(false);
    return error?.message ?? null;
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword, passwordRecovery, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
