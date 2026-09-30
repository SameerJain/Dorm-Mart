import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../utils/apiConfig.js";
import { csrfFetch } from "../../utils/csrfFetch.js";
import { LISTING_REPORT_REASONS, listingReportReasonLabel } from "../../utils/listingReportReasons.js";
import { ConfirmDialog } from "../../components/Dialog.jsx";
import { formatDateTime } from "../../utils/formatters.js";

const LIST_KEYS = {
  listing_reports: "listing_reports_page",
  reports: "reports_page",
  flagged_messages: "flagged_page",
};

const ACTION_LABELS = {
  ban_user: "Banned user",
  unban_user: "Unbanned user",
  resolve_message_report: "Resolved message report",
  dismiss_message_report: "Dismissed message report",
  remove_listing: "Removed listing",
  dismiss_listing_report: "Dismissed listing report",
  clear_message_flag: "Cleared flagged message",
  add_blocked_word: "Added blocked word",
  remove_blocked_word: "Removed blocked word",
};

function Pager({ info, onPage, disabled }) {
  if (!info || (info.page === 0 && !info.has_more)) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm">
      <button type="button" disabled={disabled || info.page === 0} onClick={() => onPage(info.page - 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Previous</button>
      <span className="text-gray-600 dark:text-gray-400">Page {info.page + 1}</span>
      <button type="button" disabled={disabled || !info.has_more} onClick={() => onPage(info.page + 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Next</button>
    </div>
  );
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Unable to complete moderation request");
  }
  return data;
}

/**
 * Message text as a moderator needs it: current text, the text before any edit,
 * and whether the sender later edited or deleted it.
 */
export function ModeratedMessageText({ message }) {
  const edited = Boolean(message.edited_at);
  const deleted = Boolean(message.deleted_at);
  const original = message.original_content;
  return (
    <div className="space-y-1">
      <p className="whitespace-pre-wrap">{message.content}</p>
      {edited && original != null && original !== message.content && (
        <p className="whitespace-pre-wrap rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <span className="font-semibold">Before edit: </span>
          {original}
        </p>
      )}
      {(edited || deleted) && (
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {[edited && "Edited by sender", deleted && "Deleted by sender"].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

function ActionButton({ children, onClick, disabled = false, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ListingReportRow({ report, working, onResolve, onChangeBan, onConfirm }) {
  const [removalReason, setRemovalReason] = useState(report.reason);
  const [note, setNote] = useState("");
  const isOpen = report.status === "open";
  const listingLive = Boolean(report.product_id && report.item_status);
  const otherOpen = Math.max(0, Number(report.open_reports_for_listing || 0) - 1);

  function remove() {
    const others = otherOpen > 0 ? ` It will also resolve ${otherOpen} other open report${otherOpen === 1 ? "" : "s"} on this listing.` : "";
    onConfirm({
      title: `Remove "${report.listing_title}"?`,
      description: `This deletes the listing and notifies the seller.${others}`,
      confirmLabel: "Remove",
      run: () => onResolve({ report_id: report.report_id, action: "remove", removal_reason: removalReason, note: note.trim() }),
    });
  }

  return (
    <tr className="border-b align-top dark:border-gray-700">
      <td className="p-3 capitalize">{report.status}</td>
      <td className="max-w-xs p-3">
        {listingLive ? (
          <Link className="font-semibold text-blue-600 hover:underline dark:text-blue-400" to={`/app/viewProduct/${report.product_id}`}>{report.listing_title}</Link>
        ) : (
          <span className="font-semibold">{report.listing_title}</span>
        )}
        <p className="mt-1 text-xs text-gray-500">{listingLive ? `${report.item_status}${report.listing_price != null ? ` · $${Number(report.listing_price).toFixed(2)}` : ""}` : "Listing no longer exists"}</p>
        {isOpen && otherOpen > 0 && <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">+{otherOpen} other open report{otherOpen === 1 ? "" : "s"}</p>}
      </td>
      <td className="max-w-sm p-3">
        <p className="font-medium">{listingReportReasonLabel(report.reason)}</p>
        {report.details && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400">{report.details}</p>}
        <p className="mt-1 text-xs text-gray-500">{formatDateTime(report.created_at)}</p>
      </td>
      <td className="p-3 text-xs text-gray-600 dark:text-gray-400">Seller: {report.seller_name || "Deleted User"}<br />Reporter: {report.reporter_name || "Deleted User"}</td>
      <td className="p-3">
        <div className="flex min-w-[14rem] flex-col gap-2">
          {isOpen && (
            <>
              {listingLive && (
                <>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Reason shown to seller
                    <select value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} disabled={working} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                      {LISTING_REPORT_REASONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} disabled={working} placeholder="Optional note to the seller" className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <ActionButton disabled={working} onClick={remove}>{listingLive ? "Remove listing" : "Resolve"}</ActionButton>
                <button type="button" disabled={working} onClick={() => onResolve({ report_id: report.report_id, action: "dismiss" })} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-600">Dismiss</button>
              </div>
            </>
          )}
          {report.seller_id && report.seller_role !== "moderator" && (
            <div><ActionButton disabled={working} onClick={() => onChangeBan(report.seller_id, Boolean(Number(report.seller_is_banned)), "Reported listing")}>{Number(report.seller_is_banned) ? "Unban seller" : "Ban seller"}</ActionButton></div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ModeratorDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [pages, setPages] = useState({ listing_reports: 0, reports: 0, flagged_messages: 0 });
  // Pending confirmation: { title, description, confirmLabel, run, banReason? }
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    setError("");
    const query = new URLSearchParams(
      Object.entries(LIST_KEYS).map(([list, param]) => [param, String(pages[list] || 0)]),
    ).toString();
    try {
      const [dashboardData, wordData] = await Promise.all([
        fetch(`${API_BASE}/moderation/dashboard.php?${query}`, { credentials: "include" }).then(readJson),
        fetch(`${API_BASE}/moderation/profanity_words.php`, { credentials: "include" }).then(readJson),
      ]);
      setDashboard(dashboardData);
      setWords(wordData.words || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [pages]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(path, body) {
    setWorking(true);
    setError("");
    try {
      await csrfFetch(`${API_BASE}/moderation/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(readJson);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  function changeBan(userId, isBanned, reason = "Unsafe chat activity") {
    if (!userId) return;
    setConfirming({
      title: isBanned ? "Unban this user?" : "Ban this user?",
      description: isBanned
        ? "They will be able to sign in again."
        : "They will be signed out everywhere and blocked from signing in.",
      confirmLabel: isBanned ? "Unban" : "Ban",
      banReason: isBanned ? null : reason,
      run: (banReason) => post("ban_user.php", {
        user_id: userId,
        banned: !isBanned,
        reason: isBanned ? "Moderator unban" : (banReason || "").trim() || reason,
      }),
    });
  }

  async function runConfirmed() {
    const pending = confirming;
    if (!pending) return;
    await pending.run(pending.banReason);
    setConfirming(null);
  }

  async function addWord(event) {
    event.preventDefault();
    const word = newWord.trim();
    if (!word) return;
    await post("profanity_words.php", { action: "add", word });
    setNewWord("");
  }

  if (!dashboard && !error) {
    return <main className="p-8 text-center text-gray-600 dark:text-gray-300">Loading moderation tools...</main>;
  }
  if (!dashboard) {
    // Nothing loaded: show the failure and a retry, not empty "No reports yet" tables.
    return (
      <main className="p-8 text-center text-gray-700 dark:text-gray-200">
        <p role="alert" className="mx-auto max-w-lg rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>
        <button type="button" onClick={load} className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600">Try again</button>
      </main>
    );
  }
  const pagination = dashboard.pagination || {};
  const goToPage = (list) => (page) => setPages((current) => ({ ...current, [list]: Math.max(0, page) }));

  const stats = dashboard?.stats || {};
  const cards = [
    ["Flagged messages", stats.flagged_messages || 0],
    ["Open reports", stats.open_reports || 0],
    ["Total reports", stats.total_reports || 0],
    ["Banned users", stats.banned_users || 0],
    ["Open listing reports", stats.open_listing_reports || 0],
  ];

  return (
    <main className="min-h-[calc(100dvh-var(--nav-h,64px))] bg-gray-50 px-4 py-8 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Moderator tools</p>
            <h1 className="text-3xl font-bold">Safety dashboard</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Flagged chat content is shown uncensored only on this protected page.</p>
          </div>
          <nav className="flex gap-3 text-sm font-semibold">
            <Link className="text-blue-600 hover:underline dark:text-blue-400" to="/privacy-policy">Privacy Policy</Link>
            <Link className="text-blue-600 hover:underline dark:text-blue-400" to="/terms-of-service">Terms of Service</Link>
            <Link className="text-blue-600 hover:underline dark:text-blue-400" to="/safety">Public safety page</Link>
          </nav>
        </header>

        {error && <p role="alert" className="rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Moderation statistics">
          {cards.map(([label, value]) => (
            <article key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              <p className="mt-1 text-3xl font-bold">{value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-xl font-bold">Listing reports</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Removing a listing deletes it, closes its chats, resolves every open report on it, and notifies the seller with the reason below.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b dark:border-gray-700"><th className="p-3">Status</th><th className="p-3">Listing</th><th className="p-3">Report</th><th className="p-3">People</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {(dashboard?.listing_reports || []).map((report) => (
                  <ListingReportRow
                    key={report.report_id}
                    report={report}
                    working={working}
                    onResolve={(body) => post("resolve_listing_report.php", body)}
                    onChangeBan={changeBan}
                    onConfirm={setConfirming}
                  />
                ))}
                {(dashboard?.listing_reports || []).length === 0 && <tr><td colSpan="5" className="p-6 text-center text-gray-500">No listing reports yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager info={pagination.listing_reports} onPage={goToPage("listing_reports")} disabled={working} />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-xl font-bold">User reports</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b dark:border-gray-700"><th className="p-3">Status</th><th className="p-3">Reported message</th><th className="p-3">Reason</th><th className="p-3">Context</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {(dashboard?.reports || []).map((report) => (
                  <tr key={report.report_id} className="border-b align-top dark:border-gray-700">
                    <td className="p-3 capitalize">{report.status}</td>
                    <td className="max-w-md p-3"><ModeratedMessageText message={report} /></td>
                    <td className="p-3">{report.reason}</td>
                    <td className="p-3 text-xs text-gray-600 dark:text-gray-400">Sender: {report.sender_name}<br />Conversation #{report.conv_id}<br />Reporter: {report.reporter_name || "Deleted User"}</td>
                    <td className="p-3"><div className="flex flex-wrap gap-2">
                      {report.status === "open" && <>
                        <ActionButton disabled={working} onClick={() => post("resolve_report.php", { report_id: report.report_id, status: "resolved" })}>Resolve</ActionButton>
                        <button type="button" disabled={working} onClick={() => post("resolve_report.php", { report_id: report.report_id, status: "dismissed" })} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-600">Dismiss</button>
                      </>}
                      {report.reported_user_id && report.reported_user_role !== "moderator" && <ActionButton disabled={working} onClick={() => changeBan(report.reported_user_id, Boolean(Number(report.reported_user_is_banned)))}>{Number(report.reported_user_is_banned) ? "Unban user" : "Ban user"}</ActionButton>}
                    </div></td>
                  </tr>
                ))}
                {(dashboard?.reports || []).length === 0 && <tr><td colSpan="5" className="p-6 text-center text-gray-500">No reports yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager info={pagination.reports} onPage={goToPage("reports")} disabled={working} />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-xl font-bold">Profanity-flagged messages</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b dark:border-gray-700"><th className="p-3">Raw message</th><th className="p-3">Sender</th><th className="p-3">Location</th><th className="p-3">Action</th></tr></thead>
              <tbody>
                {(dashboard?.flagged_messages || []).map((message) => (
                  <tr key={message.message_id} className="border-b align-top dark:border-gray-700">
                    <td className="max-w-xl p-3"><ModeratedMessageText message={message} /></td>
                    <td className="p-3">{message.sender_fname}<br /><span className="text-xs text-gray-500">{message.sender_email || "Deleted account"}</span></td>
                    <td className="p-3 text-xs">Conversation #{message.conv_id}<br />{formatDateTime(message.created_at)}</td>
                    <td className="p-3"><div className="flex flex-wrap gap-2">
                      <button type="button" disabled={working} onClick={() => post("clear_flag.php", { message_id: message.message_id })} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-600">Clear flag</button>
                      {message.sender_id && message.sender_role !== "moderator" && <ActionButton disabled={working} onClick={() => changeBan(message.sender_id, Boolean(Number(message.sender_is_banned)))}>{Number(message.sender_is_banned) ? "Unban user" : "Ban user"}</ActionButton>}
                    </div></td>
                  </tr>
                ))}
                {(dashboard?.flagged_messages || []).length === 0 && <tr><td colSpan="4" className="p-6 text-center text-gray-500">No flagged messages.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager info={pagination.flagged_messages} onPage={goToPage("flagged_messages")} disabled={working} />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-xl font-bold">Profanity word list</h2>
          <form className="mt-4 flex max-w-lg gap-2" onSubmit={addWord}>
            <input value={newWord} onChange={(event) => setNewWord(event.target.value)} maxLength={100} placeholder="Add a word or phrase" className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
            <ActionButton type="submit" disabled={working}>Add word</ActionButton>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {words.map((word) => (
              <span key={word} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-700">
                {word}
                <button type="button" disabled={working} onClick={() => post("profanity_words.php", { action: "delete", word })} aria-label={`Remove ${word}`} className="font-bold text-red-600 disabled:opacity-50">×</button>
              </span>
            ))}
          </div>
        </section>

        {(dashboard.recent_actions || []).length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-xl font-bold">Recent moderator actions</h2>
            <ul className="mt-4 divide-y divide-gray-200 text-sm dark:divide-gray-700">
              {dashboard.recent_actions.map((entry) => (
                <li key={entry.action_id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    <span className="font-semibold">{ACTION_LABELS[entry.action] || entry.action}</span>
                    {entry.target_user_name ? ` · ${entry.target_user_name}` : ""}
                    {entry.details ? <span className="text-gray-600 dark:text-gray-400">{` · ${entry.details}`}</span> : null}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {entry.moderator_name || "Former moderator"} · {formatDateTime(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={confirming.title}
          description={<p>{confirming.description}</p>}
          confirmLabel={confirming.confirmLabel}
          busyLabel="Working…"
          busy={working}
          error={error}
          onConfirm={runConfirmed}
          onCancel={() => setConfirming(null)}
        >
          {confirming.banReason != null && (
            <label className="mb-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reason (kept on the account)
              <input
                value={confirming.banReason}
                maxLength={255}
                onChange={(event) => setConfirming((current) => ({ ...current, banReason: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
          )}
        </ConfirmDialog>
      )}
    </main>
  );
}
