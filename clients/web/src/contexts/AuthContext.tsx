import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { UserRole, UserSummary } from "@/types";
import { googleLogout } from "@react-oauth/google";

interface AuthContextType {
  user: UserSummary | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  login: (user: UserSummary, access_token: string) => void;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("decp_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        console.warn("Failed to parse user from localStorage");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((user: UserSummary, access_token: string) => {
    setUser(user);
    console.log("User logged in:", user);
    localStorage.setItem("decp_user", JSON.stringify(user));
    localStorage.setItem("decp_token", access_token);
  }, []);

  const logout = useCallback(() => {
    googleLogout();
    setUser(null);
    localStorage.removeItem("decp_user");
    localStorage.removeItem("decp_token");
  }, []);

  const hasRole = useCallback(
    (roles: UserRole[]) => {
      return user ? roles.includes(user.role) : false;
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasRole,
        setIsLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
