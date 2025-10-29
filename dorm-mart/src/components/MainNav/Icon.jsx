import { Link } from "react-router-dom";

function Icon({ to, src, alt }) {
  return (
    <>
      <li>
        <Link to={to}>
          <img
            src={src}
            alt={alt}
            className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10"
          />
        </Link>
      </li>
    </>
  );
}

export default Icon;
