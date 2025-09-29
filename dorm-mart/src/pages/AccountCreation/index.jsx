import React, { useState, useMemo, useRef } from "react";
import arrow1 from "../../assets/AccountCreateAssets/Arrow1.svg";
import ellipse1 from "../../assets/AccountCreateAssets/Ellipse1.svg";
import ellipse3 from "../../assets/AccountCreateAssets/Ellipse3.svg";
import line1 from "../../assets/AccountCreateAssets/Line1.svg";
import rectangle1 from "../../assets/AccountCreateAssets/Rectangle1.svg";
import rectangle4 from "../../assets/AccountCreateAssets/Rectangle4.svg";
import vector from "../../assets/AccountCreateAssets/Vector.svg";
import youngManRunningWithShoppingCartMj66AtRemovebgPreview1 from "../../assets/AccountCreateAssets/young-man-running-with-shopping-cart-MJ66AT-removebg-preview-1.png";

export const CreateAccountPage = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    graduationMonth: "",
    graduationYear: "",
    email: "",
    agreeToTerms: false,
    receiveEmails: false,
  });
  const [touched, setTouched] = useState({});
  const yearRef = useRef(null);

  // ---- helpers ----
  const isAlpha = (s) => /^[A-Za-z][A-Za-z\s'-]*$/.test(s.trim());
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const allowedDomain = (s) =>
    s.toLowerCase().endsWith("@buffalo.edu") ||
    s.toLowerCase().endsWith("@ubuffalo.edu");

  const clampDigits = (val, maxLen) =>
    val.replace(/\D/g, "").slice(0, maxLen);

  const now = new Date();
  const thisYear = now.getFullYear();
  const maxYear = thisYear + 8;

  // ---- validation ----
  const errors = useMemo(() => {
    const e = {};
    if (!formData.firstName.trim()) e.firstName = "First name is required.";
    else if (!isAlpha(formData.firstName)) e.firstName = "Use letters only.";

    if (!formData.lastName.trim()) e.lastName = "Last name is required.";
    else if (!isAlpha(formData.lastName)) e.lastName = "Use letters only.";

    const m = Number(formData.graduationMonth);
    const y = Number(formData.graduationYear);
    if (!formData.graduationMonth) e.gradMonth = "MM";
    else if (!(m >= 1 && m <= 12)) e.gradMonth = "1–12";

    if (!formData.graduationYear) e.gradYear = "YYYY";
    else if (!(y >= thisYear && y <= maxYear)) e.gradYear = `${thisYear}–${maxYear}`;

    if (!formData.email.trim()) e.email = "UB email required.";
    else if (!isEmail(formData.email)) e.email = "Enter a valid email.";
    else if (!allowedDomain(formData.email)) e.email = "Use @buffalo.edu or @ubuffalo.edu";

    if (!formData.agreeToTerms) e.terms = "You must accept the Terms.";
    return e;
  }, [formData, thisYear, maxYear]);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  // ---- handlers ----
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const onBlur = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const handleMonthInput = (v) => {
    const clean = clampDigits(v, 2);
    handleInputChange("graduationMonth", clean);
    if (clean.length === 2 && !errors.gradMonth && yearRef.current) {
      yearRef.current.focus();
    }
  };

  const handleYearInput = (v) => {
    handleInputChange("graduationYear", clampDigits(v, 4));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // mark all as touched to show errors if any
    setTouched({
      firstName: true,
      lastName: true,
      gradMonth: true,
      gradYear: true,
      email: true,
      terms: true,
    });
    if (!isValid) return;

    // TODO: call your PHP API here
    // await api('/api/accounts', { method:'POST', body: JSON.stringify({...}) })
    console.log("Form submitted:", formData);
    alert("Account created! Check your UB email for the temporary password.");
  };

  // quick class helpers
  const errRing = "ring-2 ring-red-500";
  const inputBase =
    "px-4 h-[50px] rounded-[13px] font-['Sirin_Stencil'] text-black text-xl tracking-[2px] placeholder:opacity-50";
  const checkboxBox =
    "w-[17px] h-[17px] bg-[#b4b8ab] appearance-none checked:bg-[#284b63] checked:border-2 checked:border-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50";

  return (
    <div className="bg-[#284b63] border border-solid border-black w-full min-w-[1440px] h-[1024px] relative">
      <img className="absolute top-0 left-[421px] w-[1019px] h-[1024px]" alt="Rectangle" src={rectangle1} />

      <form onSubmit={handleSubmit} className="contents" noValidate>
        {/* FIRST NAME */}
        <input
          type="text"
          value={formData.firstName}
          onChange={(e) => handleInputChange("firstName", e.target.value)}
          onBlur={() => onBlur("firstName")}
          placeholder="First Name"
          className={`absolute top-[341px] left-[740px] w-[261px] bg-[#b4b8ab] ${inputBase} ${
            touched.firstName && errors.firstName ? errRing : ""
          }`}
          aria-label="First Name"
          required
        />
        {touched.firstName && errors.firstName && (
          <span className="absolute top-[395px] left-[740px] text-red-200 text-sm">
            {errors.firstName}
          </span>
        )}

        {/* GRAD MONTH + YEAR */}
        <div
          className={`absolute top-[407px] left-[969px] w-[308px] h-[50px] bg-[#b4b8ab] rounded-[13px] flex ${
            (touched.gradMonth && errors.gradMonth) || (touched.gradYear && errors.gradYear) ? errRing : ""
          }`}
        >
          <input
            type="text"
            inputMode="numeric"
            value={formData.graduationMonth}
            onChange={(e) => handleMonthInput(e.target.value)}
            onBlur={() => onBlur("gradMonth")}
            placeholder="Month"
            className="w-[150px] h-full bg-transparent px-4 font-['Sirin_Stencil'] text-black text-xl tracking-[2px] placeholder:opacity-50"
            aria-label="Graduation Month"
            required
          />
          <img className="w-px h-12 object-cover mt-1" alt="Line" src={line1} />
          <input
            ref={yearRef}
            type="text"
            inputMode="numeric"
            value={formData.graduationYear}
            onChange={(e) => handleYearInput(e.target.value)}
            onBlur={() => onBlur("gradYear")}
            placeholder="Year"
            className="flex-1 h-full bg-transparent px-4 font-['Sirin_Stencil'] text-black text-xl tracking-[2px] placeholder:opacity-50"
            aria-label="Graduation Year"
            required
          />
        </div>
        {(touched.gradMonth && errors.gradMonth) && (
          <span className="absolute top-[461px] left-[969px] text-red-200 text-sm">{errors.gradMonth}</span>
        )}
        {(touched.gradYear && errors.gradYear) && (
          <span className="absolute top-[461px] left-[1128px] text-red-200 text-sm">{errors.gradYear}</span>
        )}

        {/* LAST NAME */}
        <input
          type="text"
          value={formData.lastName}
          onChange={(e) => handleInputChange("lastName", e.target.value)}
          onBlur={() => onBlur("lastName")}
          placeholder="Last Name"
          className={`absolute top-[341px] left-[1017px] w-[261px] bg-[#b4b8ab] ${inputBase} ${
            touched.lastName && errors.lastName ? errRing : ""
          }`}
          aria-label="Last Name"
          required
        />
        {touched.lastName && errors.lastName && (
          <span className="absolute top-[395px] left-[1017px] text-red-200 text-sm">
            {errors.lastName}
          </span>
        )}

        {/* EMAIL */}
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange("email", e.target.value)}
          onBlur={() => onBlur("email")}
          placeholder="University Email Address"
          className={`absolute top-[470px] left-[740px] w-[537px] bg-[#b4b8ab] ${inputBase} ${
            touched.email && errors.email ? errRing : ""
          }`}
          aria-label="University Email Address"
          required
        />
        {touched.email && errors.email && (
          <span className="absolute top-[524px] left-[740px] text-red-200 text-sm">
            {errors.email}
          </span>
        )}

        {/* TERMS CHECKBOX (required) */}
        <div className="absolute top-[548px] left-[798px] flex items-center">
          <input
            type="checkbox"
            id="agreeToTerms"
            checked={formData.agreeToTerms}
            onChange={() => handleCheckboxChange("agreeToTerms")}
            onBlur={() => onBlur("terms")}
            className={`${checkboxBox} ${touched.terms && errors.terms ? "outline outline-2 outline-red-500" : ""}`}
            required
          />
          <label
            htmlFor="agreeToTerms"
            className="ml-[14px] font-['Sirin_Stencil'] text-white text-lg tracking-[1.80px] leading-[normal] cursor-pointer"
          >
            I have agreed to the terms and conditions
          </label>
        </div>
        {touched.terms && errors.terms && (
          <span className="absolute top-[575px] left-[798px] text-red-200 text-sm">
            {errors.terms}
          </span>
        )}

        {/* PROMO CHECKBOX (optional) */}
        <div className="absolute top-[593px] left-[740px] flex items-center">
          <input
            type="checkbox"
            id="receiveEmails"
            checked={formData.receiveEmails}
            onChange={() => handleCheckboxChange("receiveEmails")}
            className={checkboxBox}
          />
          <label
            htmlFor="receiveEmails"
            className="ml-[14px] font-['Sirin_Stencil'] text-white text-lg tracking-[1.80px] leading-[normal] cursor-pointer"
          >
            I would like to receive emails about promotional content
          </label>
        </div>

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={!isValid}
          className={`absolute top-[651px] left-[969px] w-20 h-[70px] flex items-center justify-center rounded-[20px] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50
            ${isValid ? "bg-[#284b63] hover:bg-[#1e3a4f] cursor-pointer" : "bg-[#193341] opacity-60 cursor-not-allowed"}`}
          aria-label="Submit form"
        >
          <img className="w-[41.35px] h-[19.88px]" alt="Arrow" src={arrow1} />
        </button>
      </form>

      {/* static decorative/layout elements */}
      <header className="absolute top-[95px] left-[190px] font-['Taprom'] text-[#f4f9e9] text-[32px] tracking-[3.20px]">
        wastage who?
      </header>

      <h1 className="absolute top-[-30px] left-[calc(50.00%_-_636px)] w-[562px] font-['Tai_Heritage_Pro'] font-bold text-[#f4f9e9] text-8xl">
        Dorm Mart
      </h1>

      <h2 className="absolute top-[231px] left-[827px] font-['Sirin_Stencil'] text-white text-5xl tracking-[4.80px]">
        Create Account
      </h2>

      <img
        className="absolute top-[330px] left-0 w-[711px] h-[694px] aspect-[0.95] object-cover"
        alt="Young man running with shopping cart"
        src={youngManRunningWithShoppingCartMj66AtRemovebgPreview1}
      />

      <p className="absolute w-[27.08%] h-[2.54%] top-[72.17%] left-[56.53%] font-['Sirin_Stencil'] text-white text-lg text-center">
        <a href="/login" className="hover:underline focus:outline-none focus:underline">
          Already have an account? Go back to Log In
        </a>
      </p>

      <img className="absolute top-[110px] left-[655px] w-[706px] h-[713px]" alt="Rectangle background" src={rectangle4} />
      <img className="absolute top-[171px] left-[989px] w-10 h-11" alt="Ellipse decoration" src={ellipse1} />
      <img className="absolute top-[172px] left-[994px] w-[22px] h-[34px]" alt="Ellipse decoration" src={ellipse3} />
      <img className="absolute top-0 left-[462px] w-[978px] h-[1024px]" alt="Vector background" src={vector} />

      <label className="absolute top-[409px] left-[740px] font-['Sirin_Stencil'] text-white text-2xl tracking-[2.40px]">
        Graduation Date:
      </label>
    </div>
  );
};

export default CreateAccountPage;
