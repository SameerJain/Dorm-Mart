import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // Navigate to main page when arrow is clicked
    navigate('/app');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor: '#1c3244'}}>
      {/* Border frame */}
      <div className="w-full max-w-4xl h-[500px] border-2 border-gray-800 relative overflow-hidden rounded-lg" style={{backgroundColor: '#313fb2'}}>
        {/* Background */}
        <div className="absolute inset-0 rounded-lg" style={{backgroundColor: '#313fb2'}}></div>
        
        {/* Content container */}
        <div className="relative z-10 h-full flex items-center justify-center">
          {/* Left side - Branding */}
          <div className="flex-1 flex flex-col justify-center items-center p-8">
            {/* Title */}
            <div className="text-center">
              <h1 className="text-6xl font-serif text-white mb-2">Dorm Mart</h1>
            </div>
          </div>
          
          {/* Right side - Login form */}
          <div className="w-96 flex items-center justify-center p-8">
            <div className="bg-slate-700 p-8 rounded-lg relative w-full max-w-sm">
              {/* Torn paper effect */}
              <div className="absolute inset-0 bg-slate-700 rounded-lg" 
                   style={{
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
                  {/* Email input */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">University Email Address</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-3 bg-gray-200 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder=""
                    />
                  </div>
                  
                  {/* Password input */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Password</label>
                    <input 
                      type="password" 
                      className="w-full px-4 py-3 bg-gray-200 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder=""
                    />
                  </div>
                  
                  {/* Login button with arrow */}
                  <button 
                    type="submit"
                    className="w-full bg-blue-800 hover:bg-blue-900 text-white py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                  >
                    <span>Login</span>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </form>
                
                {/* Links */}
                <div className="mt-6 text-center">
                  <div className="flex items-center justify-center space-x-2 text-sm text-white">
                    <a href="#" className="hover:underline">create account</a>
                    <span className="w-1 h-1 bg-black rounded-full"></span>
                    <a href="#" className="hover:underline">forgot password?</a>
                  </div>
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
