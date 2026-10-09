import React, { createContext, useState, useEffect, useMemo, useCallback } from "react";

/**
 * AuthContext manages user authentication state and tokens.
 *
 * TOKEN STORAGE SECURITY ARCHITECTURE & TRADEOFFS:
 * - Current Mechanism: Web Storage (localStorage) key 'pfa_auth_token'.
 * - Tradeoffs:
 *   - Benefit: Simple, stateless client-side session persistence across tabs and refreshes.
 *   - Risk: Tokens stored in localStorage can be accessed by scripts running in the page origin,
 *     which increases vulnerability to Cross-Site Scripting (XSS).
 *   - Mitigation / Future Upgrade: For high-security production environments, migrate to
 *     HTTP-only, SameSite=Strict secure cookies paired with short-lived access tokens and refresh tokens.
 */
export const AuthContext = createContext(null);

const TOKEN_KEY = "pfa_auth_token";
const USER_KEY = "pfa_auth_user";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(USER_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  // Synchronize authentication state across browser tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === TOKEN_KEY || e.key === USER_KEY) {
        const currentToken = localStorage.getItem(TOKEN_KEY);
        setToken(currentToken);
        try {
          const currentUser = localStorage.getItem(USER_KEY);
          setUser(currentUser ? JSON.parse(currentUser) : null);
        } catch {
          setUser(null);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Sync token and user to localStorage
  const login = useCallback((userData, accessToken) => {
    setToken(accessToken);
    setUser(userData);
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isLoading,
      setIsLoading,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

