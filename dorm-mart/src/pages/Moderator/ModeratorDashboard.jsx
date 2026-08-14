import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../utils/apiConfig.js";
import { csrfFetch } from "../../utils/csrfFetch.js";

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Unable to complete moderation request");
  }
  return data;
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

export default function ModeratorDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [dashboardData, wordData] = await Promise.all([
        fetch(`${API_BASE}/moderation/dashboard.php`, { credentials: "include" }).then(readJson),
        fetch(`${API_BASE}/moderation/profanity_words.php`, { credentials: "include" }).then(readJson),
      ]);
      setDashboard(dashboardData);
      setWords(wordData.words || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

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

  async function changeBan(userId, isBanned) {
    if (!userId) return;
    const action = isBanned ? "unban" : "ban";
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
    await post("ban_user.php", {
      user_id: userId,
      banned: !isBanned,
      reason: "Unsafe chat activity",
    });
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

  const stats = dashboard?.stats || {};
  const cards = [
    ["Flagged messages", stats.flagged_messages || 0],
    ["Open reports", stats.open_reports || 0],
    ["Total reports", stats.total_reports || 0],
    ["Banned users", stats.banned_users || 0],
  ];

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gray-50 px-4 py-8 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
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
          </nav>
        </header>

        {error && <p role="alert" className="rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Moderation statistics">
          {cards.map(([label, value]) => (
            <article key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              <p className="mt-1 text-3xl font-bold">{value}</p>
            </article>
          ))}
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
                    <td className="max-w-md whitespace-pre-wrap p-3">{report.content}</td>
                    <td className="p-3">{report.reason}</td>
                    <td className="p-3 text-xs text-gray-600 dark:text-gray-400">Sender: {report.sender_name}<br />Conversation #{report.conv_id}<br />Reporter: {report.reporter_name || "Deleted User"}</td>
                    <td className="p-3"><div className="flex flex-wrap gap-2">
                      {report.status === "open" && <>
                        <ActionButton disabled={working} onClick={() => post("resolve_report.php", { report_id: report.report_id, status: "resolved" })}>Resolve</ActionButton>
                        <button type="button" disabled={working} onClick={() => post("resolve_report.php", { report_id: report.report_id, status: "dismissed" })} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-600">Dismiss</button>
                      </>}
                      {report.reported_user_id && <ActionButton disabled={working} onClick={() => changeBan(report.reported_user_id, Boolean(Number(report.reported_user_is_banned)))}>{Number(report.reported_user_is_banned) ? "Unban user" : "Ban user"}</ActionButton>}
                    </div></td>
                  </tr>
                ))}
                {(dashboard?.reports || []).length === 0 && <tr><td colSpan="5" className="p-6 text-center text-gray-500">No reports yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-xl font-bold">Profanity-flagged messages</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b dark:border-gray-700"><th className="p-3">Raw message</th><th className="p-3">Sender</th><th className="p-3">Location</th><th className="p-3">Action</th></tr></thead>
              <tbody>
                {(dashboard?.flagged_messages || []).map((message) => (
                  <tr key={message.message_id} className="border-b align-top dark:border-gray-700">
                    <td className="max-w-xl whitespace-pre-wrap p-3">{message.content}</td>
                    <td className="p-3">{message.sender_fname}<br /><span className="text-xs text-gray-500">{message.sender_email || "Deleted account"}</span></td>
                    <td className="p-3 text-xs">Conversation #{message.conv_id}<br />{new Date(message.created_at).toLocaleString()}</td>
                    <td className="p-3">{message.sender_id && <ActionButton disabled={working} onClick={() => changeBan(message.sender_id, Boolean(Number(message.sender_is_banned)))}>{Number(message.sender_is_banned) ? "Unban user" : "Ban user"}</ActionButton>}</td>
                  </tr>
                ))}
                {(dashboard?.flagged_messages || []).length === 0 && <tr><td colSpan="4" className="p-6 text-center text-gray-500">No flagged messages.</td></tr>}
              </tbody>
            </table>
          </div>
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
      </div>
    </main>
  );
}
