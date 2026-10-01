import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { legalDocuments } from "./legalDocuments";

/** Stable id for a section heading, used by the table of contents. */
export function sectionId(title) {
  return `legal-${String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

export default function LegalDocumentPage({ documentKey }) {
  // Not named `document`: that shadowed the browser global this page needs.
  const legalDoc = legalDocuments[documentKey];
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!legalDoc) return undefined;
    const previousTitle = window.document.title;
    window.document.title = `${legalDoc.title} | Dorm Mart`;
    return () => {
      window.document.title = previousTitle;
    };
  }, [legalDoc]);

  const handleBack = () => {
    const from = location.state?.from || "/login";
    const accountDraft = location.state?.accountDraft;
    navigate(from, {
      state: accountDraft ? { accountDraft } : undefined,
      replace: true,
    });
  };

  // The app uses a hash router, so "#section" links would be read as routes.
  // Scroll to the heading instead.
  const jumpTo = (title) => {
    const target = window.document.getElementById(sectionId(title));
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
  };

  if (!legalDoc) {
    return (
      <main className="min-h-dvh pre-login-bg px-4 py-10 text-center text-gray-800">
        <p className="rounded-2xl bg-white p-8 shadow-xl">This document could not be found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh pre-login-bg px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-gray-800 sm:px-6 sm:py-10 print:bg-white print:p-0">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-xl sm:p-8 md:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            <span aria-hidden="true" className="mr-2">←</span>
            Back
          </button>
          {/* Uses the browser's print dialog ("Save as PDF"), so the copy always
              matches the text on this page. */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            Download or print (PDF)
          </button>
        </div>

        <header className="border-b border-gray-200 pb-6">
          <h1 className="font-serif text-3xl font-bold text-gray-900 sm:text-4xl">
            {legalDoc.title}
          </h1>
          <p className="mt-2 text-sm font-medium text-gray-500">
            Last Updated: {legalDoc.updated}
          </p>
          <p className="mt-5 leading-7 text-gray-700">{legalDoc.intro}</p>
          <p className="mt-3 text-sm print:hidden">
            <button
              type="button"
              onClick={() => navigate("/safety")}
              className="font-semibold text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              See how reports are handled
            </button>{" "}
            <span className="text-gray-500">(live, anonymous safety numbers)</span>
          </p>
        </header>

        {legalDoc.sections.length > 3 && (
          <nav aria-label="Contents" className="mt-6 rounded-xl bg-gray-50 p-4 print:hidden">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
              Contents
            </h2>
            <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {legalDoc.sections.map((section) => (
                <li key={section.title}>
                  <button
                    type="button"
                    onClick={() => jumpTo(section.title)}
                    className="text-left text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="mt-7 space-y-8">
          {legalDoc.sections.map((section) => (
            <section key={section.title} className="print:break-inside-avoid-page">
              <h2
                id={sectionId(section.title)}
                tabIndex={-1}
                className="scroll-mt-4 text-xl font-bold text-gray-900 outline-none sm:text-2xl"
              >
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-7 text-gray-700">
                  {paragraph}
                </p>
              ))}
              {section.items && (
                <ul className="mt-3 list-disc space-y-1.5 pl-6 text-gray-700">
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              {section.groups?.map((group) => (
                <div key={group.title} className="mt-4">
                  <h3 className="font-semibold text-gray-900">{group.title}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-6 text-gray-700">
                    {group.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ))}
              {section.after?.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-7 text-gray-700">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        {legalDoc.closing && (
          <p className="mt-8 border-t border-gray-200 pt-6 font-semibold leading-7 text-gray-900">
            {legalDoc.closing}
          </p>
        )}
      </article>
    </main>
  );
}
