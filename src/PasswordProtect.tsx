import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

interface PasswordProtectProps {
  children: React.ReactNode;
}

const PasswordProtect: React.FC<PasswordProtectProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Check if user is already authenticated on mount
  useEffect(() => {
    const storedAuth = sessionStorage.getItem('authenticated');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = import.meta.env.VITE_PASSWORD;
    
    if (password === correctPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem('authenticated', 'true');
      setError('');
    } else {
      setError('Invalid password');
      setPassword('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-100 rounded-full p-4">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            Protected Area
          </h1>
          <p className="text-center text-gray-600 mb-6">
            Please enter the password to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PasswordProtect;
