import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');

function ScheduleMessageCard({ message, isMine, onRespond }) {
  const navigate = useNavigate();
  const metadata = message.metadata || {};
  const messageType = metadata.type;
  const requestId = metadata.request_id;
  const [isResponding, setIsResponding] = useState(false);

  const handleAction = async (action) => {
    if (!requestId || isResponding) return;
    setIsResponding(true);
    try {
      const res = await fetch(`${API_BASE}/scheduled-purchases/respond.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          request_id: requestId,
          action: action,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${action} request`);
      }
      const result = await res.json();
      if (result.success && onRespond) {
        onRespond();
      } else {
        throw new Error(result.error || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      alert(error.message || `Failed to ${action} request. Please try again.`);
    } finally {
      setIsResponding(false);
    }
  };

  const handleAccept = () => handleAction('accept');
  const handleDeny = () => handleAction('decline');

  // Format meeting date/time
  const formatMeetingTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Use consistent styling for all schedule messages - matching site's color scheme
  const getMessageConfig = () => {
    switch (messageType) {
      case 'schedule_request':
        return {
          bgColor: 'bg-blue-600 to-blue-700',
          borderColor: 'border-blue-400',
          iconColor: 'text-blue-100',
          showActions: !isMine, // Buyer sees actions
        };
      case 'schedule_accepted':
        return {
          bgColor: 'bg-green-600 to-green-700',
          borderColor: 'border-green-400',
          iconColor: 'text-green-100',
          showActions: false,
        };
      case 'schedule_denied':
        return {
          bgColor: 'bg-red-600 to-red-700',
          borderColor: 'border-red-400',
          iconColor: 'text-red-100',
          showActions: false,
        };
      case 'schedule_cancelled':
        return {
          bgColor: 'bg-orange-500 to-orange-600',
          borderColor: 'border-orange-400',
          iconColor: 'text-orange-100',
          showActions: false,
        };
      default:
        return {
          bgColor: 'bg-blue-600 to-blue-700',
          borderColor: 'border-blue-400',
          iconColor: 'text-blue-100',
          showActions: false,
        };
    }
  };

  const config = getMessageConfig();
  const meetingAt = metadata.meeting_at ? formatMeetingTime(metadata.meeting_at) : null;
  const meetLocation = metadata.meet_location || null;
  const description = metadata.description || null;
  const verificationCode = metadata.verification_code || null;
  const productTitle = metadata.product_title || null;
  const productId = metadata.product_id || metadata.inventory_product_id || null;

  return (
    <div className={`max-w-[85%] rounded-2xl border-2 ${config.borderColor} bg-gradient-to-br ${config.bgColor} text-white shadow-lg overflow-hidden`}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <svg className={`w-5 h-5 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-bold text-base text-white">
            {message.content}
          </p>
        </div>
        
        {/* Product title for schedule_request messages */}
        {messageType === 'schedule_request' && productTitle && (
          <div className="px-3 py-2 rounded-lg bg-white/25 backdrop-blur-sm">
            <p className="text-sm font-semibold text-white">
              <span className="font-bold">Item:</span> {productTitle}
            </p>
          </div>
        )}
        
        {(meetingAt || meetLocation || description || verificationCode) && (
          <div className="px-3 py-2 rounded-lg bg-white/20 backdrop-blur-sm space-y-2">
            {meetingAt && (
              <p className="text-sm text-white/90">
                <span className="font-semibold">Meeting Time:</span> {meetingAt}
              </p>
            )}
            {meetLocation && (
              <p className="text-sm text-white/90">
                <span className="font-semibold">Location:</span> {meetLocation}
              </p>
            )}
            {description && (
              <p className="text-sm text-white/90">
                <span className="font-semibold">Description:</span> {description}
              </p>
            )}
            {verificationCode && (
              <p className="text-sm text-white/90">
                <span className="font-semibold">Verification Code:</span> <span className="font-mono font-bold">{verificationCode}</span>
              </p>
            )}
          </div>
        )}

        {config.showActions && messageType === 'schedule_request' && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAccept}
              disabled={isResponding}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition shadow-md"
            >
              {isResponding ? 'Processing...' : 'Accept'}
            </button>
            <button
              onClick={handleDeny}
              disabled={isResponding}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition shadow-md"
            >
              {isResponding ? 'Processing...' : 'Deny'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScheduleMessageCard;

