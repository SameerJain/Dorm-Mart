import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import backgroundImage from '../assets/images/login-page-left-side-background.jpg';

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Client-side validation
    if (!email.trim()) {
      setError('Please input a valid email address');
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError('Please input a password');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password
        })
      });

      const data = await response.json();

      if (data.ok) {
        // Store login state in localStorage
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', email.trim());
        
        // Navigate to main page on successful login
        navigate('/app');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Background image with branding (50%) */}
      <div className="w-1/2 relative">
        {/* Background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${backgroundImage})`
          }}
        ></div>
        
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        
        {/* Branding content */}
        <div className="relative z-10 h-full flex flex-col justify-center items-center p-8">
          <div className="text-center">
            <h1 className="text-9xl font-serif text-white mb-6 flex items-center justify-center space-x-6">
              <span>Dorm</span>
              <span>Mart</span>
            </h1>
            <h2 className="text-4xl font-light text-white opacity-90">Wastage Who?</h2>
          </div>
        </div>
      </div>
      
      {/* Right side - Login form (50%) */}
      <div className="w-1/2 flex items-center justify-center p-8" style={{backgroundColor: '#364156'}}>
        <div className="w-full max-w-md">
          <div className="p-8 rounded-lg relative" style={{backgroundColor: '#3d3eb5'}}>
            {/* Torn paper effect */}
            <div className="absolute inset-0 rounded-lg" 
                 style={{
                   backgroundColor: '#3d3eb5',
                   clipPath: 'polygon(0 0, 100% 0, 100% 85%, 95% 90%, 100% 95%, 100% 100%, 0 100%)'
                 }}></div>
            
            <div className="relative z-10">
              {/* Header with dot */}
              <div className="text-center mb-8">
                <div className="w-3 h-3 bg-black rounded-full mx-auto mb-4"></div>
                <h2 className="text-4xl font-serif text-white">Log In</h2>
              </div>
              
              {/* Login form */}
              <form onSubmit={handleLogin} className="space-y-6">
                {/* Error message */}
                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                
                {/* Email input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">University Email Address</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                    placeholder="student@university.edu"
                  />
                </div>
                
                {/* Password input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                    placeholder="SecurePass123"
                  />
                </div>
                
                {/* Login button with arrow */}
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-1/3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white py-2 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium mx-auto"
                >
                  <span>{loading ? 'Logging in...' : 'Login'}</span>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </form>
              
              {/* Links */}
              <div className="mt-6 text-center">
                <div className="flex items-center justify-center space-x-2 text-base text-white">
                  <a 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); navigate('/create-account'); }}
                    className="hover:underline hover:text-blue-400 transition-colors duration-200"
                  >
                    create account
                  </a>
                  <span className="w-1 h-1 bg-black rounded-full"></span>
                  <a 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}
                    className="hover:underline hover:text-blue-400 transition-colors duration-200"
                  >
                    forgot password?
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
