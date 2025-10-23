import { useNavigate } from "react-router-dom";

function ResetPasswordError({ errorType = "expired" }) {
  const navigate = useNavigate();

  const getErrorContent = () => {
    switch (errorType) {
      case "expired":
        return {
          title: "Reset Link Expired",
          message: "This password reset link has expired. Please request a new one.",
          icon: "⏰"
        };
      case "invalid":
        return {
          title: "Invalid Reset Link", 
          message: "This password reset link is invalid. Please use the link from your email.",
          icon: "❌"
        };
      default:
        return {
          title: "Reset Link Error",
          message: "There was an issue with your password reset link. Please try again.",
          icon: "⚠️"
        };
    }
  };

  const { title, message, icon } = getErrorContent();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#2563EB' }}>
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
          {/* Error Icon */}
          <div className="text-6xl mb-6">{icon}</div>
          
          {/* Error Title */}
          <h1 className="text-2xl font-serif font-semibold text-red-600 mb-4">{title}</h1>
          
          {/* Error Message */}
          <p className="text-gray-600 mb-6">{message}</p>
          
          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/forgot-password')}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Request New Reset Link
            </button>
            
            <button
              onClick={() => navigate('/login')}
              className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordError;

