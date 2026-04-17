import { createContext } from "react";

export type AppRole = "student" | "teacher" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
}

export interface AuthContextType {
  session: { access_token: string } | null;
  user: AuthUser | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
