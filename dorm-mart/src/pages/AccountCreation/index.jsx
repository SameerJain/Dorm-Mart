import React, { useEffect, useMemo, useState } from "react";
import bg from "../../assets/AccountCreateAssets/bg.jpg";
import arrow1 from "../../assets/AccountCreateAssets/Arrow1.svg";

const BASE_W = 1920;
const BASE_H = 1080;

const CreateAccountPage = () => {
  // --- SCALE: fit height (touch top & bottom), leave side gutters ---
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const calc = () => {
      const h = window.innerHeight / BASE_H; // fit height exactly
      setScale(h);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    calc();
    window.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("resize", calc);
      document.body.style.overflow = prev;
    };
  }, []);

  // ----- form state -----
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    graduationMonth: "",
    graduationYear: "",
    email: "",
    agreeToTerms: false,
    receiveEmails: false,
  });
  const setVal = (k, v) => setFormData((s) => ({ ...s, [k]: v }));
  const onYearChange = (v) =>
    setVal("graduationYear", v.replace(/\D/g, "").slice(0, 4));

  // ----- validation -----
  const isAlpha = (s) => /^[A-Za-z][A-Za-z\s'-]*$/.test(s.trim());
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const isUB = (s) =>
    s.toLowerCase().endsWith("@buffalo.edu") ||
    s.toLowerCase().endsWith("@ubuffalo.edu");
  const year = Number(formData.graduationYear);
  const thisYear = new Date().getFullYear();
  const maxYear = thisYear + 8;

  const errors = useMemo(() => {
    const e = {};
    if (!formData.firstName.trim()) e.firstName = "Required";
    else if (!isAlpha(formData.firstName)) e.firstName = "Letters/spaces only";
    if (!formData.lastName.trim()) e.lastName = "Required";
    else if (!isAlpha(formData.lastName)) e.lastName = "Letters/spaces only";
    if (!formData.graduationMonth) e.gradMonth = "Choose a month";
    if (!formData.graduationYear) e.gradYear = "Enter year";
    else if (!(year >= thisYear && year <= maxYear))
      e.gradYear = `Year ${thisYear}-${maxYear}`;
    if (!formData.email.trim()) e.email = "Required";
    else if (!isEmail(formData.email)) e.email = "Invalid";
    else if (!isUB(formData.email)) e.email = "Use @buffalo.edu/@ubuffalo.edu";
    if (!formData.agreeToTerms) e.terms = "Accept Terms";
    return e;
  }, [formData, year, thisYear, maxYear]);

  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    console.log("Form submitted:", formData);
    alert("Account created! Check your UB email for your temporary password.");
  };

  const ph = "placeholder:text-black placeholder:opacity-50";
  const fSirin = "[font-family:'Sirin Stencil',serif]";

  return (
    // Viewport wrapper: bg = #284B63, no scroll, center the scaled canvas
    <div className="w-screen h-screen overflow-hidden bg-[#284B63] relative">
      {/* Center horizontally & vertically; scale by height */}
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Background image */}
        <img
          src={bg}
          alt="Dorm Mart background"
          className="absolute inset-0 w-[1920px] h-[1080px] object-cover pointer-events-none select-none"
        />

        {/* Interactive layer */}
        <form onSubmit={handleSubmit} className="relative z-10" noValidate>
          {/* First Name */}
          <div className="absolute top-[372px] left-[1024px] w-[261px] h-[50px] bg-[#b4b8ab] rounded-[13px]">
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setVal("firstName", e.target.value)}
              placeholder="First Name"
              className={`w-full h-full px-4 bg-transparent ${fSirin} text-black text-xl tracking-[2px] rounded-[13px] ${ph} ${
                errors.firstName ? "ring-2 ring-red-500" : ""
              }`}
              aria-label="First Name"
              required
            />
          </div>

          {/* Last Name */}
          <div className="absolute top-[372px] left-[1301px] w-[261px] h-[50px] bg-[#b4b8ab] rounded-[13px]">
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setVal("lastName", e.target.value)}
              placeholder="Last Name"
              className={`w-full h-full px-4 bg-transparent ${fSirin} text-black text-xl tracking-[2px] rounded-[13px] ${ph} ${
                errors.lastName ? "ring-2 ring-red-500" : ""
              }`}
              aria-label="Last Name"
              required
            />
          </div>

          {/* Hidden label for a11y (graphic has the text) */}
          <div className={`sr-only absolute top-[440px] left-[1024px] ${fSirin} text-white text-2xl`}>
            Graduation Date:
          </div>

          {/* Month + Year */}
          <div
            className={`absolute top-[438px] left-[1253px] w-[308px] h-[50px] bg-[#b4b8ab] rounded-[13px] flex ${
              errors.gradMonth || errors.gradYear ? "ring-2 ring-red-500" : ""
            }`}
          >
            {/* Month with overlay placeholder */}
            <div className="relative w-[150px] h-full rounded-l-[13px]">
              <select
                value={formData.graduationMonth}
                onChange={(e) => setVal("graduationMonth", e.target.value)}
                className={`absolute inset-0 w-full h-full appearance-none bg-transparent px-4 ${fSirin} text-xl tracking-[2px] rounded-l-[13px] ${
                  formData.graduationMonth ? "text-black" : "text-transparent"
                }`}
                aria-label="Graduation Month"
                required
              >
                <option value="" disabled>Month</option>
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
              {!formData.graduationMonth && (
                <span className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${fSirin} text-xl tracking-[2px] text-black/50`}>
                  Month
                </span>
              )}
            </div>

            {/* Divider */}
            <div className="absolute left-[133px] top-[6px] h-[38px] w-px bg-black/40 pointer-events-none" />

            {/* Year with overlay placeholder */}
            <div className="relative flex-1 h-full rounded-r-[13px]">
              <input
                type="text"
                inputMode="numeric"
                value={formData.graduationYear}
                onChange={(e) => onYearChange(e.target.value)}
                className={`absolute inset-0 w-full h-full px-4 bg-transparent ${fSirin} text-xl tracking-[2px] rounded-r-[13px] ${
                  formData.graduationYear ? "text-black" : "text-transparent"
                }`}
                aria-label="Graduation Year"
                required
              />
              {!formData.graduationYear && (
                <span className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${fSirin} text-xl tracking-[2px] text-black/50`}>
                  Year
                </span>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="absolute top-[501px] left-[1024px] w-[537px] h-[50px] bg-[#b4b8ab] rounded-[13px]">
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setVal("email", e.target.value)}
              placeholder="University Email Address"
              className={`w-full h-full px-4 bg-transparent ${fSirin} text-black text-xl tracking-[2px] rounded-[13px] ${ph} ${
                errors.email ? "ring-2 ring-red-500" : ""
              }`}
              aria-label="University Email Address"
              required
            />
          </div>

          {/* Terms */}
          <div className="absolute top-[579px] left-[1082px] flex items-center">
            <input
              id="agreeToTerms"
              type="checkbox"
              checked={formData.agreeToTerms}
              onChange={() => setVal("agreeToTerms", !formData.agreeToTerms)}
              className={`w-[17px] h-[17px] bg-[#b4b8ab] appearance-none checked:bg-[#284b63] checked:border-2 checked:border-white ${
                errors.terms ? "outline outline-2 outline-red-500" : ""
              }`}
              aria-required="true"
            />
            <label className={`ml-[14px] cursor-pointer ${fSirin} text-white text-lg tracking-[1.8px]`} htmlFor="agreeToTerms">
              I have agreed to the terms and conditions
            </label>
          </div>

          {/* Promo */}
          <div className="absolute top-[624px] left-[1024px] flex items-center">
            <input
              id="receiveEmails"
              type="checkbox"
              checked={formData.receiveEmails}
              onChange={() => setVal("receiveEmails", !formData.receiveEmails)}
              className="w-[17px] h-[17px] bg-[#b4b8ab] appearance-none checked:bg-[#284b63] checked:border-2 checked:border-white"
            />
            <label className={`ml-[14px] cursor-pointer ${fSirin} text-white text-lg tracking-[1.8px]`} htmlFor="receiveEmails">
              I would like to receive emails about promotional content
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid}
            className={`absolute top-[651px] left-[969px] w-20 h-[70px] flex items-center justify-center rounded-[20px] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white ${
              isValid ? "bg-[#284b63] hover:bg-[#1e3a4f] cursor-pointer" : "bg-[#193341] opacity-60 cursor-not-allowed"
            }`}
            aria-label="Submit form"
          >
            <img src={arrow1} alt="Submit" className="w-[41.35px] h-[19.88px] pointer-events-none" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateAccountPage;
