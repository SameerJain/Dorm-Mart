import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const validate = () => {
    let newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";

    if (!formData.gradMonth || !formData.gradYear) {
      newErrors.gradDate = "Graduation month and year are required";
    } else {
      const month = parseInt(formData.gradMonth, 10);
      const year = parseInt(formData.gradYear, 10);
      if (month < 1 || month > 12) {
        newErrors.gradDate = "Invalid month";
      } else {
        const now = new Date();
        const gradDate = new Date(year, month - 1);
        const maxDate = new Date(now.getFullYear() + 8, now.getMonth());
        if (gradDate < now) newErrors.gradDate = "Graduation date cannot be in the past";
        if (gradDate > maxDate) newErrors.gradDate = "Graduation date must be within 8 years";
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!formData.email.endsWith("@buffalo.edu")) {
      newErrors.email = "Email must be a buffalo.edu address";
    }

    if (!formData.terms) newErrors.terms = "You must agree to the terms";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      alert("Account Created Successfully!");
      navigate('/login');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#1c3244' }}
    >
      <div
        className="w-full max-w-4xl border-2 border-gray-800 relative overflow-hidden rounded-lg"
        style={{ backgroundColor: '#313fb2' }}
      >
        <div className="relative z-10 flex items-stretch justify-center">
          {/* Left branding */}
          <div className="flex-1 flex flex-col justify-center items-center p-8 bg-[#313fb2]">
            <h1 className="text-6xl font-serif text-white mb-2">Dorm Mart</h1>
          </div>

          {/* Right side - Create Account Form */}
          <div className="w-96 flex items-center justify-center p-8 bg-slate-700">
            <div className="w-full max-w-sm">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-3 h-3 bg-black rounded-full mx-auto mb-4"></div>
                <h2 className="text-4xl font-serif text-white">Create Account</h2>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm text-gray-300 mb-2">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.firstName && <p className="text-red-400 text-xs">{errors.firstName}</p>}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.lastName && <p className="text-red-400 text-xs">{errors.lastName}</p>}
                </div>

                {/* Graduation Date */}
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Graduation Date (Month / Year)</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      name="gradMonth"
                      value={formData.gradMonth}
                      onChange={handleChange}
                      placeholder="MM"
                      className="w-1/2 px-4 py-3 bg-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      name="gradYear"
                      value={formData.gradYear}
                      onChange={handleChange}
                      placeholder="YYYY"
                      className="w-1/2 px-4 py-3 bg-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {errors.gradDate && <p className="text-red-400 text-xs">{errors.gradDate}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm text-gray-300 mb-2">University Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.email && <p className="text-red-400 text-xs">{errors.email}</p>}
                </div>

                {/* Checkboxes */}
                <div className="space-y-2">
                  <label className="flex items-center text-gray-300">
                    <input
                      type="checkbox"
                      name="terms"
                      checked={formData.terms}
                      onChange={handleChange}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    I agree to the terms and conditions
                  </label>
                  {errors.terms && <p className="text-red-400 text-xs">{errors.terms}</p>}

                  <label className="flex items-center text-gray-300">
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
                  className="w-full bg-blue-800 hover:bg-blue-900 text-white py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                >
                  <span>Confirm</span>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </form>

              {/* Link back to login */}
              <div className="mt-6 text-center">
                <a
                  href="#"
                  onClick={() => navigate('/login')}
                  className="text-sm text-white hover:underline"
                >
                  Already have an account? Go back to Log In
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateAccountPage;
