import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  // Comprehensive protection: prevent back navigation and handle missing tokens
  useEffect(() => {
    // Check if user has already visited this page (prevent back navigation)
    if (sessionStorage.getItem('resetPageVisited')) {
      navigate('/login?error=reset_link_expired', { replace: true });
      return;
    }

    // Handle missing token
    if (!token) {
      navigate('/login?error=invalid_reset_link', { replace: true });
      return;
    }

    // Prevent back button navigation
    const handlePopState = () => navigate('/login?error=reset_link_expired', { replace: true });
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, [token, navigate]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#2563EB' }}>
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
            <h1 className="text-2xl font-serif font-semibold text-red-600 mb-4">Invalid Reset Link</h1>
            <p className="text-gray-600 mb-6">No reset token provided. Please use the link from your email.</p>
            <button 
              onClick={() => navigate('/login')}
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}

export default ResetPasswordPage;
