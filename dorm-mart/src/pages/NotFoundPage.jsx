import { Link, useLocation, useNavigate } from "react-router-dom";

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block align-middle text-blue-500 dark:text-sky-400"
      style={{ width: "0.78em", height: "0.78em", marginBottom: "0.06em" }}
      aria-hidden="true"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith("/app");
  const homePath = isAppRoute ? "/app" : "/";

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gray-50 px-4 py-16 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <section className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <div
          className="flex items-center justify-center font-black leading-none tracking-tighter"
          style={{ fontSize: "clamp(7rem, 22vw, 13rem)" }}
        >
          <span className="text-blue-600 dark:text-blue-500">4</span>
          <CartIcon />
          <span className="text-blue-600 dark:text-blue-500">4</span>
        </div>

        <h1 className="mt-4 text-2xl font-bold sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-base text-gray-500 dark:text-gray-400">
          Looks like this listing got away. The page you&apos;re looking for
          doesn&apos;t exist or may have been moved.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to={homePath}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            Go home
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 px-5 text-sm font-semibold text-gray-700 transition hover:bg-white active:scale-95 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Go back
          </button>
        </div>
      </section>
    </main>
  );
}
