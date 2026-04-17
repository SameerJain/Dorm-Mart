import { useNavigate } from 'react-router-dom';
import backgroundImage from '../assets/images/cf704b7b8689fdfa8cf49a9f368bb17c.jpg';

function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50">
      {/* Left side - Background image with branding (hidden on mobile, 50% on desktop) */}
      <div className="hidden lg:block lg:w-1/2 relative min-h-screen">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            filter: 'brightness(1.15)',
          }}
        ></div>

        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black bg-opacity-30"></div>

        {/* Branding content */}
        <div className="relative z-10 h-full flex flex-col justify-center items-center p-4 lg:p-8">
          <div className="text-center w-full px-4">
            <h1 className="text-6xl lg:text-8xl xl:text-9xl font-serif text-white mb-4 lg:mb-6 flex flex-col lg:flex-row items-center justify-center lg:space-x-6 leading-tight lg:leading-normal animate-fade-in">
              <span>Dorm</span>
              <span>Mart</span>
            </h1>
            <h2 className="text-2xl lg:text-3xl xl:text-4xl font-light text-white opacity-90 animate-fade-in-delay">
              Wastage, who?
            </h2>
            <p className="text-lg lg:text-xl text-white opacity-80 mt-6 lg:mt-8 max-w-md mx-auto animate-fade-in-delay-2">
              Your campus marketplace for buying and selling. Connect with fellow students and save money.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Action buttons (full width on mobile, 50% on desktop) */}
      <div
        className="w-full lg:w-1/2 flex flex-col items-center justify-center p-4 sm:p-8 md:pt-16 md:pb-8 min-h-screen relative overflow-hidden"
        style={{ backgroundColor: "#364156" }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-40 h-40 bg-purple-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-indigo-500 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Mobile branding header (visible only on mobile) */}
        <div className="lg:hidden mb-8 text-center relative z-10">
          <h1 className="text-5xl md:text-8xl font-serif text-white mb-2 animate-fade-in">Dorm Mart</h1>
          <h2 className="text-xl md:text-4xl font-light text-white opacity-90 mb-4 animate-fade-in-delay">
            Wastage, who?
          </h2>
          <p className="text-base md:text-xl text-white opacity-80 max-w-sm md:max-w-lg mx-auto animate-fade-in-delay-2">
            Your campus marketplace for buying and selling.
          </p>
        </div>

        {/* Action buttons container */}
        <div className="w-full max-w-md md:max-w-xl space-y-4 md:space-y-6 relative z-10 animate-slide-up">
          {/* Welcome message */}
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-serif text-white mb-3">
              Welcome!
            </h2>
            <p className="text-lg md:text-2xl text-gray-300">
              Get started with Dorm Mart
            </p>
          </div>

          {/* Login Button */}
          <button
            onClick={() => navigate('/login')}
            className="w-full py-4 md:py-6 px-6 rounded-lg text-lg md:text-2xl font-semibold text-white transition-all duration-300 transform hover:scale-105 hover:shadow-2xl active:scale-95"
            style={{ 
              backgroundColor: "#3d3eb5",
              boxShadow: "0 4px 15px rgba(61, 62, 181, 0.4)"
            }}
          >
            Log In
          </button>

          {/* Create Account Button */}
          <button
            onClick={() => navigate('/create-account')}
            className="w-full transform rounded-lg bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95 dark:shadow-[0_4px_15px_rgba(30,64,175,0.45)] md:py-6 md:text-2xl"
          >
            Create Account
          </button>

          {/* Additional info */}
          <p className="text-sm md:text-lg text-gray-400 text-center mt-6">
            Join the community and start trading today!
          </p>
        </div>
      </div>

      {/* Add custom animations via style tag */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        
        .animate-fade-in-delay {
          animation: fade-in 0.8s ease-out 0.2s both;
        }
        
        .animate-fade-in-delay-2 {
          animation: fade-in 0.8s ease-out 0.4s both;
        }
        
        .animate-slide-up {
          animation: slide-up 0.8s ease-out 0.6s both;
        }
      `}</style>
    </div>
  );
}

export default WelcomePage;

