import { useNavigate } from 'react-router-dom';

function ForgotPasswordConfirmation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#364156' }}>
      {/* Centered confirmation card, reused styling without "Stay Here" */}
      <div className="relative z-10 w-full max-w-lg mx-auto rounded-xl shadow-2xl border border-white/10"
           style={{ backgroundColor: '#3d3eb5' }}>
        <div className="p-6 sm:p-8">
          <h3 className="text-xl sm:text-2xl font-serif text-white mb-3 text-center">Check Your Email</h3>
          <p className="text-sm sm:text-base text-white/90 text-center leading-relaxed">
            A link to reset your password is sent to your email.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => { navigate('/login'); }}
              className="px-5 py-2 sm:py-2.5 text-sm sm:text-base rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordConfirmation;


