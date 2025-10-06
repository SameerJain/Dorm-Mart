import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import backgroundImage from '../../assets/images/login-page-left-side-background.jpg';
import termsPdf from '../../assets/pdfs/terms&conditions.pdf';
import privacyPdf from '../../assets/pdfs/privacy.pdf';

function CreateAccountPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gradMonth: "",
    gradYear: "",
    email: "",
    terms: false,
    promos: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";

    if (!formData.gradMonth || !formData.gradYear) {
      newErrors.gradDate = "Graduation month and year are required";
    } else {
      const month = parseInt(formData.gradMonth, 10);
      const year = parseInt(formData.gradYear, 10);

      if (Number.isNaN(month) || month < 1 || month > 12) {
        newErrors.gradDate = "Invalid month";
      } else if (Number.isNaN(year) || year < 1900) {
        newErrors.gradDate = "Invalid year";
      } else {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const gradDate = new Date(year, month - 1, 1);
        const maxDate = new Date(now.getFullYear() + 8, now.getMonth(), 1);
        if (gradDate < new Date(now.getFullYear(), now.getMonth(), 1)) newErrors.gradDate = "Graduation date cannot be in the past";
        if (gradDate > maxDate) newErrors.gradDate = "Graduation date must be within 8 years";
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!formData.email.toLowerCase().endsWith("@buffalo.edu")) {
      newErrors.email = "Email must be a buffalo.edu address";
    }

    if (!formData.terms) newErrors.terms = "You must agree to the terms";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await fetch(`api/auth/create_account.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          gradMonth: formData.gradMonth,
          gradYear: formData.gradYear,
          email: formData.email.trim(),
          promos: formData.promos
        }),
      });
      setShowNotice(true);
    } catch {
      setShowNotice(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Background image with branding (50%) */}
      <div className="w-1/2 relative">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div className="absolute inset-0 bg-black bg-opacity-40" />
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

      {/* Right side - Create Account form (50%) */}
      <div className="w-1/2 flex items-center justify-center p-8" style={{ backgroundColor: '#364156' }}>
        <div className="w-full max-w-md">
          <div className="p-8 rounded-lg relative" style={{ backgroundColor: '#3d3eb5' }}>
            {/* Torn paper effect */}
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                backgroundColor: '#3d3eb5',
                clipPath: 'polygon(0 0, 100% 0, 100% 85%, 95% 90%, 100% 95%, 100% 100%, 0 100%)'
              }}
            />

            <div className="relative z-10">
              {/* Header with dot */}
              <div className="text-center mb-8">
                <div className="w-3 h-3 bg-black rounded-full mx-auto mb-4" />
                <h2 className="text-4xl font-serif text-white">Create Account</h2>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                  />
                  {errors.firstName && <p className="text-red-200 text-xs mt-1">{errors.firstName}</p>}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                  />
                  {errors.lastName && <p className="text-red-200 text-xs mt-1">{errors.lastName}</p>}
                </div>

                {/* Graduation Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">Graduation Date (Month / Year)</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      name="gradMonth"
                      value={formData.gradMonth}
                      onChange={handleChange}
                      placeholder="MM"
                      className="w-1/2 px-4 py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                    />
                    <input
                      type="number"
                      name="gradYear"
                      value={formData.gradYear}
                      onChange={handleChange}
                      placeholder="YYYY"
                      className="w-1/2 px-4 py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                    />
                  </div>
                  {errors.gradDate && <p className="text-red-200 text-xs mt-1">{errors.gradDate}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">University Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                  />
                  {errors.email && <p className="text-red-200 text-xs mt-1">{errors.email}</p>}
                </div>

                {/* Checkboxes */}
                <div className="space-y-2">
                  <label className="flex items-center text-gray-100">
                    <input
                      type="checkbox"
                      name="terms"
                      checked={formData.terms}
                      onChange={handleChange}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="select-none">
                      I agree to the{" "}
                      <a
                        href={termsPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-white/70 hover:decoration-white hover:text-blue-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Terms & Conditions
                      </a>{" "}
                      and{" "}
                      <a
                        href={privacyPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-white/70 hover:decoration-white hover:text-blue-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Privacy Policy
                      </a>
                    </span>
                  </label>
                  {errors.terms && <p className="text-red-200 text-xs mt-1">{errors.terms}</p>}

                  <label className="flex items-center text-gray-100">
                    <input
                      type="checkbox"
                      name="promos"
                      checked={formData.promos}
                      onChange={handleChange}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    I want to receive promotional news on my email
                  </label>
                </div>

                {/* Confirm button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-1/3 text-white py-2 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 font-medium mx-auto
                    ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 hover:scale-105 hover:shadow-lg'}
                  `}
                >
                  <span>{loading ? 'Submitting…' : 'Confirm'}</span>
                  {!loading && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </form>

              {/* Links */}
              <div className="mt-6 text-center">
                <div className="flex items-center justify-center space-x-2 text-base text-white">
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); navigate('/login'); }}
                    className="hover:underline hover:text-blue-300 transition-colors duration-200"
                  >
                    already have an account? log in
                  </a>
                  <span className="w-1 h-1 bg-black rounded-full" />
                  <a
                    href="#"
                    className="hover:underline hover:text-blue-300 transition-colors duration-200"
                    onClick={(e)=>e.preventDefault()}
                  >
                    forgot password?
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notice Modal */}
      {showNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowNotice(false)}
          />
          {/* card */}
          <div className="relative z-10 w-full max-w-lg mx-4 rounded-xl shadow-2xl border border-white/10"
               style={{ backgroundColor: '#3d3eb5' }}>
            <div className="p-6">
              <h3 className="text-2xl font-serif text-white mb-3 text-center">Check Your Email</h3>
              <p className="text-white/90 text-center leading-relaxed">
                If an account using the email does not already exist, a temporary password has been sent to the email.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={() => { setShowNotice(false); navigate('/login'); }}
                  className="px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                >
                  Go to Login
                </button>
                <button
                  onClick={() => setShowNotice(false)}
                  className="px-5 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  Stay Here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default CreateAccountPage;
