import { useEffect, useRef, useState } from "react";
import searchIcon from "../../assets/icons/icons8-search-96.png";
import { API_BASE } from "../../utils/apiConfig";
import { apiGetJson, csrfPostJson } from "../../utils/apiClient";

const historyUrl = `${API_BASE}/search/recent_searches.php`;

export default function SearchBar({ onSearch, userId }) {
  const [text, setText] = useState("");
  const [recent, setRecent] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const controllerRef = useRef(null);
  const queueRef = useRef(Promise.resolve());
  const revisionRef = useRef(0);

  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    controllerRef.current = controller;
    const revision = revisionRef.current;
    apiGetJson(historyUrl, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted && revision === revisionRef.current) {
          setRecent(result.data);
        }
      })
      .catch(() => {}); // Search remains available if history cannot load.
    return () => controller.abort();
  }, [userId]);

  const updateHistory = (body, previous) => {
    const signal = controllerRef.current?.signal;
    if (!userId || !signal || signal.aborted) return;
    const revision = ++revisionRef.current;
    setError("");
    // Keep rapid submissions and Clear history in the order the user made them.
    queueRef.current = queueRef.current.then(async () => {
      if (signal.aborted) return;
      try {
        await csrfPostJson(historyUrl, body, { signal });
      } catch {
        if (!signal.aborted && revision === revisionRef.current) {
          if (body.action === "clear") setRecent(previous);
          setError(body.action === "clear" ? "Could not clear search history. Please try again." : "Could not save this search. Please try again.");
        }
      }
    });
  };

  const submit = (value) => {
    const term = value.trim();
    if (term && userId) {
      setRecent((items) => [term, ...items.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 10));
      updateHistory({ term });
    }
    setText(term);
    setOpen(false);
    onSearch(term);
  };

  return (
    <div className="relative flex-1 min-w-0 mx-0.5 sm:mx-2 md:mx-3 lg:mx-5" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <form role="search" onSubmit={(event) => { event.preventDefault(); submit(text); }} className="flex h-10 sm:h-11 md:h-15 min-w-0 items-center overflow-hidden rounded-full bg-white shadow-inner focus-within:ring-2 focus-within:ring-blue-300">
        <input type="search" aria-label="Search listings" placeholder="Search" value={text} ref={inputRef} maxLength={50} autoComplete="off"
          onFocus={() => setOpen(true)} onChange={(event) => { setText(event.target.value); setOpen(true); }}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); } }}
          className="h-full w-full pl-4 pr-2 sm:pl-5 sm:pr-3 text-sm md:text-base text-slate-900 placeholder-slate-400 focus:outline-none min-w-0" />
        {text && <button type="button" aria-label="Clear search" onClick={() => { setText(""); inputRef.current?.focus(); }} className="px-3 h-full text-slate-500 hover:text-slate-700">×</button>}
        <button type="submit" aria-label="Search" className="flex h-full w-9 shrink-0 items-center justify-center border-l border-slate-200 focus:outline-none focus-visible:bg-slate-100 sm:w-12 md:w-16 lg:w-20">
          <img src={searchIcon} alt="" className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
        </button>
      </form>
      {open && (recent.length > 0 || error) && (
        <section aria-label="Recent searches" className="absolute inset-x-0 top-full z-50 mt-2 max-h-[60dvh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 text-gray-900 shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
          {error && <p role="alert" className="px-2 py-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
          {recent.length > 0 && <>
            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <h2 className="text-sm font-semibold">Recent searches</h2>
              <button type="button" onClick={() => { updateHistory({ action: "clear" }, recent); setRecent([]); }} className="rounded px-2 py-2 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-gray-700">Clear history</button>
            </div>
            <ul>{recent.map((term) => <li key={term}><button type="button" onClick={() => submit(term)} className="w-full break-words rounded px-3 py-2.5 text-left text-sm hover:bg-gray-100 focus-visible:bg-gray-100 dark:hover:bg-gray-700 dark:focus-visible:bg-gray-700">{term}</button></li>)}</ul>
          </>}
        </section>
      )}
    </div>
  );
}
