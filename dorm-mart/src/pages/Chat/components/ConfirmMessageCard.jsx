import { useMemo, useState } from 'react';

const API_BASE = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');

const FAILURE_REASON_LABELS = {
  buyer_no_show: 'Buyer no showed',
  insufficient_funds: 'Buyer did not have enough money',
  other: 'Other',
};

function formatDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

export default function ConfirmMessageCard({ message, isMine, onRespond }) {
  const metadata = message.metadata || {};
  const messageType = metadata.type;
  const confirmRequestId = metadata.confirm_request_id;

  const [localStatus, setLocalStatus] = useState(() => {
    if (messageType === 'confirm_accepted' || messageType === 'confirm_auto_accepted') return 'accepted';
    if (messageType === 'confirm_denied') return 'declined';
    return null;
  });
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState('');

  const snapshot = metadata.snapshot || {};
  const productTitle = metadata.product_title || snapshot.item_title || 'This item';
  const meetingTime = metadata.meeting_at || snapshot.meeting_at;
  const meetLocation = metadata.meet_location || snapshot.meet_location;
  const expiresAt = metadata.expires_at;
  const respondedAt = metadata.responded_at || null;

  const isSuccessful = metadata.is_successful ?? snapshot.is_successful ?? true;
  const finalPrice = metadata.final_price ?? snapshot.negotiated_price ?? null;
  const sellerNotes = metadata.seller_notes ?? snapshot.description ?? null;
  const failureReason = metadata.failure_reason;
  const failureReasonNotes = metadata.failure_reason_notes;

  const isActionableRequest =
    messageType === 'confirm_request' && !isMine && localStatus === null && !!confirmRequestId;

  const statusDescriptor = useMemo(() => {
    if (messageType === 'confirm_accepted') return { label: 'Buyer accepted', tone: 'success' };
    if (messageType === 'confirm_auto_accepted') return { label: 'Auto accepted', tone: 'success' };
    if (messageType === 'confirm_denied') return { label: 'Buyer denied', tone: 'danger' };
    if (messageType === 'confirm_request' && localStatus === 'accepted') return { label: 'Response sent', tone: 'success' };
    if (messageType === 'confirm_request' && localStatus === 'declined') return { label: 'Response sent', tone: 'danger' };
    if (messageType === 'confirm_request' && isMine) return { label: 'Waiting for buyer', tone: 'info' };
    if (messageType === 'confirm_request' && !isMine) return { label: 'Action required', tone: 'warning' };
    return { label: 'Update', tone: 'info' };
  }, [isMine, localStatus, messageType]);

  const toneClasses = {
    success: {
      container: 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700',
      badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
    },
    danger: {
      container: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
    },
    warning: {
      container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600',
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-100',
    },
    info: {
      container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100',
    },
  };

  const visual = toneClasses[statusDescriptor.tone] || toneClasses.info;

  const handleAction = async (action) => {
    if (!confirmRequestId || isResponding) return;
    setIsResponding(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/confirm-purchases/respond.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          confirm_request_id: confirmRequestId,
          action,
        }),
      });
      const payload = await res.json().catch(() => ({ success: false, error: 'Unexpected response' }));
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Unable to ${action} the confirmation.`);
      }
      setLocalStatus(action === 'accept' ? 'accepted' : 'declined');
      if (typeof onRespond === 'function') {
        onRespond();
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsResponding(false);
    }
  };

  const failureReasonLabel = failureReason ? FAILURE_REASON_LABELS[failureReason] || 'Other' : null;
  const formattedPrice = formatCurrency(finalPrice);
  const formattedMeeting = formatDate(meetingTime);
  const formattedExpires = formatDate(expiresAt);
  const formattedResponded = formatDate(respondedAt);

  return (
    <div className={`w-full max-w-md border rounded-2xl px-4 py-3 text-sm shadow ${visual.container}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-300">Confirm Purchase</p>
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isSuccessful ? 'Marked Successful' : 'Marked Unsuccessful'}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{productTitle}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${visual.badge}`}>
          {statusDescriptor.label}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-gray-800 dark:text-gray-100">
        {formattedPrice && (
          <p>
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-1">Final price:</span>
            {formattedPrice}
          </p>
        )}
        {formattedMeeting && (
          <p>
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-1">Met:</span>
            {formattedMeeting}
          </p>
        )}
        {meetLocation && (
          <p>
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-1">Location:</span>
            {meetLocation}
          </p>
        )}
        {sellerNotes && (
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Notes</p>
            <p className="mt-0.5 whitespace-pre-wrap text-gray-800 dark:text-gray-100">{sellerNotes}</p>
          </div>
        )}
        {!isSuccessful && failureReasonLabel && (
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Reason</p>
            <p className="font-medium">{failureReasonLabel}</p>
            {failureReasonNotes && (
              <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-100 mt-0.5">{failureReasonNotes}</p>
            )}
          </div>
        )}
      </div>

      {messageType === 'confirm_request' && (
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-300">
          Buyer has 24 hours to respond{formattedExpires ? ` (expires ${formattedExpires})` : ''}.
        </p>
      )}

      {formattedResponded && messageType !== 'confirm_request' && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Updated {formattedResponded}</p>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {isActionableRequest && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => handleAction('accept')}
            disabled={isResponding}
            className="inline-flex justify-center rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60"
          >
            {isResponding ? 'Sending…' : 'Confirm'}
          </button>
          <button
            onClick={() => handleAction('decline')}
            disabled={isResponding}
            className="inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900/30 focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            {isResponding ? 'Sending…' : 'Deny'}
          </button>
        </div>
      )}
    </div>
  );
}
