import { useLocation, useNavigate } from "react-router-dom";
import { legalDocuments } from "./legalDocuments";

export default function LegalDocumentPage({ documentKey }) {
  const document = legalDocuments[documentKey];
  const location = useLocation();
  const navigate = useNavigate();

  const handleBack = () => {
    const from = location.state?.from || "/login";
    const accountDraft = location.state?.accountDraft;
    navigate(from, {
      state: accountDraft ? { accountDraft } : undefined,
      replace: true,
    });
  };

  return (
    <main className="min-h-dvh pre-login-bg px-4 py-6 text-gray-800 sm:px-6 sm:py-10">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-xl sm:p-8 md:p-10">
        <button
          type="button"
          onClick={handleBack}
          className="mb-6 inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          <span aria-hidden="true" className="mr-2">←</span>
          Back
        </button>

        <header className="border-b border-gray-200 pb-6">
          <h1 className="font-serif text-3xl font-bold text-gray-900 sm:text-4xl">
            {document.title}
          </h1>
          <p className="mt-2 text-sm font-medium text-gray-500">
            Last Updated: {document.updated}
          </p>
          <p className="mt-5 leading-7 text-gray-700">{document.intro}</p>
        </header>

        <div className="mt-7 space-y-8">
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
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

        {document.closing && (
          <p className="mt-8 border-t border-gray-200 pt-6 font-semibold leading-7 text-gray-900">
            {document.closing}
          </p>
        )}
      </article>
    </main>
  );
}
