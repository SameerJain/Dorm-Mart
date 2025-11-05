import { Link } from "react-router-dom";

function Icon({ to, src, alt, badge }) {

  const showBadge = Number(badge) > 0;
  
  return (
    <li>
      {/* relative: positioning context for the absolute badge */}
      <Link to={to} className="relative inline-block">
        <img
          src={src}
          alt={alt}
          className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10"
        />
        {showBadge && (
          <span
            // absolute: pin to the corner; ring: small white border to separate from bg
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs leading-5 text-center ring-2 ring-white"
            aria-label={`${badge} unread`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
    </li>
  );
}

export default Icon;
