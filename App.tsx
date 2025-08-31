import React, { useState, useCallback, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import { auth } from './firebaseConfig';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { useAppStore } from './store';

// --- Login Component Definition ---
const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
       await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
       if (email === 'demo' && password === 'demo') {
        await signInWithEmailAndPassword(auth, 'demo@demo.com', 'demo');
       } else {
        await signInWithEmailAndPassword(auth, email, password);
       }
    } catch (err: any) {
         if (err.code && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') && email === 'demo' && password === 'demo') {
            setError('Failed to log in. Please create a user with email "demo@demo.com" and password "demo" in your Firebase console.');
        } else {
            setError('Invalid credentials. Note: a demo user can be created at demo@demo.com with password demo');
        }
    }
  }, [email, password, rememberMe]);

  return (
    <div className="relative flex items-center justify-center min-h-screen p-4 overflow-hidden">
      {/* The background is now controlled by a class on the body tag */}
      <div className="relative z-10 w-full max-w-md p-10 space-y-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center">
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900">Brain Damage</h1>
          <p className="mt-4 text-base text-slate-600">The first system to make a zombie organized</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="text"
                autoComplete="email"
                required
                className="relative block w-full h-11 px-4 text-slate-900 placeholder-slate-500 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:z-10 sm:text-base"
                placeholder="Email (demo@demo.com)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full h-11 px-4 text-slate-900 placeholder-slate-500 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:z-10 sm:text-base"
                placeholder="Password (demo)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">
              Remember me
            </label>
          </div>

          {error && (
            <div className="p-4 text-sm text-red-800 bg-red-100 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="relative flex justify-center w-full h-11 items-center px-5 text-base font-semibold text-white transition-colors bg-indigo-600 border border-transparent rounded-xl group hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Main App Component ---
const App: React.FC = () => {
  const { user, setUser } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUser]);

  // Effect to manage body classes for login background
  useEffect(() => {
    if (user === null && !loading) {
        document.body.classList.add('login-background');
        document.body.classList.remove('bg-slate-50', 'text-slate-900');
    } else {
        document.body.classList.remove('login-background');
        document.body.classList.add('bg-slate-50', 'text-slate-900');
    }
    return () => {
      document.body.classList.remove('login-background');
      document.body.classList.add('bg-slate-50', 'text-slate-900');
    }
  }, [user, loading]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  return (
    <div className="antialiased text-slate-900">
      {user ? <Dashboard onLogout={handleLogout} /> : <Login />}
    </div>
  );
};

export default App;