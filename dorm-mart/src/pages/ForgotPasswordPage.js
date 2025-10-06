import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react'
import backgroundImage from '../assets/images/login-page-left-side-background.jpg';

function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [errorMsg, setRrrorMsg] = useState("");

    const handleForgotPassword = (e) => {
        e.preventDefault();
        // Navigate to main page when arrow is clicked

        const valid = emailValidation(email);
        setIsValid(valid);

        if (!valid) {
            setRrrorMsg("Email must be a valid UB email address");
            return;
        }

        navigate('/login');
    };

    function emailValidation(email) {
        // Basic format: some text + @buffalo.edu (case-insensitive)
        const pattern = /^[A-Za-z0-9]+@buffalo\.edu$/i
        return pattern.test(email.trim());
    }

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
      
      {/* Right side - forgot password form (50%) */}
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
                <h2 className="text-4xl font-serif text-white">Forgot Pasword? </h2>
              </div>
              
              {/* forgot password form */}
              <form onSubmit={handleForgotPassword} noValidate className="space-y-6">
                {/* email input input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">University Email Address</label>
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                    placeholder="ubname@buffalo.edu"
                  />
                </div>
                {/* email validation msg */}
                <p className="text-red-500 text-sm font-medium text-center">
                {errorMsg}
                </p>
                {/* request button with arrow */}
                <button type="submit" className="w-80 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium mx-auto" > <span>Send Temporary Password</span> <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"> <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /> </svg> </button>
              </form>


              {/* Links */}
              <div className="mt-6 text-center">
                <div className="flex items-center justify-center space-x-2 text-base text-white">
                  <a 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); navigate('/create-account'); }}
                    className="hover:underline hover:text-blue-400 transition-colors duration-200"
                  >
                    Create account
                  </a>
                  <span className="w-1 h-1 bg-black rounded-full"></span>
                  <a 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); navigate('/login'); }}
                    className="hover:underline hover:text-blue-400 transition-colors duration-200"
                  >
                    Go back to login
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

export default ForgotPasswordPage;
