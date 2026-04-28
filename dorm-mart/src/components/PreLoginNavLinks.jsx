import { useNavigate } from "react-router-dom";

const baseContainerClass =
  "flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-white";

const baseButtonClass =
  "min-h-[44px] flex items-center px-2 py-2 hover:underline transition-colors duration-200 bg-transparent border-none text-white cursor-pointer";

export default function PreLoginNavLinks({
  links,
  className = "",
  hoverClassName = "hover:text-blue-400",
  buttonClassName = "",
}) {
  const navigate = useNavigate();

  return (
    <div className={`${baseContainerClass} ${className}`.trim()}>
      {links.map((link, index) => (
        <span key={link.to} className="contents">
          {index > 0 && <span className="w-1 h-1 bg-black rounded-full" />}
          <button
            type="button"
            onClick={() => navigate(link.to)}
            className={`${baseButtonClass} ${hoverClassName} ${buttonClassName}`.trim()}
          >
            {link.label}
          </button>
        </span>
      ))}
    </div>
  );
}
