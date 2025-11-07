import { useContext, useEffect, useMemo, useState } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { MEET_LOCATION_OPTIONS, MEET_LOCATION_OTHER_VALUE } from '../../constants/meetLocations';

const API_BASE = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');

function SchedulePurchasePage() {
    const { conversations } = useContext(ChatContext) || { conversations: [] };

    const [listings, setListings] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    const [selectedListingId, setSelectedListingId] = useState('');
    const [selectedConversationId, setSelectedConversationId] = useState('');
    const [meetLocationChoice, setMeetLocationChoice] = useState('');
    const [customMeetLocation, setCustomMeetLocation] = useState('');
    const [meetingAt, setMeetingAt] = useState(''); // datetime-local value
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const abort = new AbortController();
        async function loadListings() {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`${API_BASE}/seller-dashboard/manage_seller_listings.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include',
                    signal: abort.signal,
                    body: JSON.stringify({}),
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data = await res.json();
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load listings');
                }
                setListings(Array.isArray(data.data) ? data.data : []);
            } catch (e) {
                if (e.name !== 'AbortError') {
                    setError('Unable to load your listings right now.');
                }
            } finally {
                setLoading(false);
            }
        }

        loadListings();
        return () => abort.abort();
    }, []);

    useEffect(() => {
        const abort = new AbortController();
        async function loadRequests() {
            setLoadingRequests(true);
            try {
                const res = await fetch(`${API_BASE}/scheduled-purchases/list_seller.php`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                    signal: abort.signal,
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const payload = await res.json();
                if (!payload.success) {
                    throw new Error(payload.error || 'Failed to load scheduled purchases');
                }
                setRequests(Array.isArray(payload.data) ? payload.data : []);
            } catch (e) {
                if (e.name !== 'AbortError') {
                    setError('Unable to load scheduled purchases right now.');
                }
            } finally {
                setLoadingRequests(false);
            }
        }

        loadRequests();
        return () => abort.abort();
    }, []);

    const conversationOptions = useMemo(() => {
        if (!Array.isArray(conversations)) return [];
        return conversations.map((c) => ({
            convId: c.conv_id,
            receiverId: c.receiverId,
            label: c.receiverName || `User #${c.receiverId}`,
        }));
    }, [conversations]);

    const listingOptions = useMemo(() => {
        if (!Array.isArray(listings)) return [];
        return listings.map((l) => ({
            id: l.id,
            title: l.title,
            price: l.price,
            status: l.status,
        }));
    }, [listings]);

    const resetForm = () => {
        setSelectedListingId('');
        setSelectedConversationId('');
        setMeetLocationChoice('');
        setCustomMeetLocation('');
        setMeetingAt('');
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');

        const trimmedCustomLocation = customMeetLocation.trim();
        const finalMeetLocation = meetLocationChoice === MEET_LOCATION_OTHER_VALUE
            ? trimmedCustomLocation
            : meetLocationChoice;

        if (!selectedListingId || !selectedConversationId || !finalMeetLocation || !meetingAt) {
            setFormError('Please complete all required fields before submitting.');
            return;
        }

        const meetingDate = new Date(meetingAt);
        if (Number.isNaN(meetingDate.getTime())) {
            setFormError('Please provide a valid meeting date and time.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/scheduled-purchases/create.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    inventory_product_id: Number(selectedListingId),
                    conversation_id: Number(selectedConversationId),
                    meet_location: finalMeetLocation,
                    meet_location_choice: meetLocationChoice,
                    custom_meet_location: meetLocationChoice === MEET_LOCATION_OTHER_VALUE ? trimmedCustomLocation : null,
                    meeting_at: meetingDate.toISOString(),
                }),
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const payload = await res.json();
            if (!payload.success) {
                throw new Error(payload.error || 'Failed to create schedule');
            }

            setFormSuccess('Schedule created successfully. Share the verification code with your buyer when you meet.');
            resetForm();
            await refreshRequests();
        } catch (err) {
            setFormError(err.message === 'Failed to create schedule' ? err.message : 'Could not create the schedule. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function refreshRequests() {
        setLoadingRequests(true);
        try {
            const res = await fetch(`${API_BASE}/scheduled-purchases/list_seller.php`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include',
            });
            if (!res.ok) {
                throw new Error('HTTP error');
            }
            const payload = await res.json();
            if (!payload.success) {
                throw new Error('Failed to load scheduled purchases');
            }
            setRequests(Array.isArray(payload.data) ? payload.data : []);
        } catch (e) {
            setError('Unable to refresh scheduled purchases.');
        } finally {
            setLoadingRequests(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Schedule a Purchase</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">
                        Coordinate a meetup with a buyer you are chatting with. They will confirm on their side and share the
                        provided 4-character code at the exchange.
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Select Listing</label>
                            <select
                                value={selectedListingId}
                                onChange={(e) => setSelectedListingId(e.target.value)}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={loading || listingOptions.length === 0}
                            >
                                <option value="">{loading ? 'Loading your listings...' : 'Choose a listing'}</option>
                                {listingOptions.map((listing) => (
                                    <option key={listing.id} value={listing.id}>
                                        {listing.title} {listing.price ? `( $${Number(listing.price).toFixed(2)} )` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Select Buyer (Active Conversations)</label>
                            <select
                                value={selectedConversationId}
                                onChange={(e) => setSelectedConversationId(e.target.value)}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={conversationOptions.length === 0}
                            >
                                <option value="">{conversationOptions.length ? 'Choose a buyer' : 'No active conversations found'}</option>
                                {conversationOptions.map((conv) => (
                                    <option key={conv.convId} value={conv.convId}>
                                        {conv.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Meet Location</label>
                            <select
                                value={meetLocationChoice}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setMeetLocationChoice(value);
                                    if (value !== MEET_LOCATION_OTHER_VALUE) {
                                        setCustomMeetLocation('');
                                    }
                                }}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {MEET_LOCATION_OPTIONS.map((option) => (
                                    <option key={option.value || 'unselected'} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {meetLocationChoice === MEET_LOCATION_OTHER_VALUE && (
                                <input
                                    type="text"
                                    value={customMeetLocation}
                                    onChange={(e) => setCustomMeetLocation(e.target.value)}
                                    maxLength={255}
                                    placeholder="Enter meet location"
                                    className="mt-2 w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Meeting Date &amp; Time</label>
                            <input
                                type="datetime-local"
                                value={meetingAt}
                                onChange={(e) => setMeetingAt(e.target.value)}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {formError && (
                            <div className="text-sm text-red-600 dark:text-red-400">{formError}</div>
                        )}
                        {formSuccess && (
                            <div className="text-sm text-green-600 dark:text-green-400">{formSuccess}</div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            >
                                {isSubmitting ? 'Scheduling...' : 'Schedule Purchase'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="mt-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Scheduled Purchases</h2>
                        <button
                            type="button"
                            onClick={refreshRequests}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            disabled={loadingRequests}
                        >
                            {loadingRequests ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>

                    {loadingRequests ? (
                        <div className="text-gray-600 dark:text-gray-300">Loading scheduled purchases...</div>
                    ) : requests.length === 0 ? (
                        <div className="text-gray-600 dark:text-gray-400">No scheduled purchases yet.</div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map((req) => (
                                <div key={req.request_id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 shadow-sm">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{req.item?.title || 'Listing'}</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">Buyer: {req.buyer?.first_name} {req.buyer?.last_name}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">Location: {req.meet_location}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                                Meeting: {req.meeting_at ? new Date(req.meeting_at).toLocaleString() : 'Not set'}
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">Status: {req.status}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">Verification Code: <span className="font-mono text-base text-blue-600 dark:text-blue-400">{req.verification_code}</span></p>
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 self-start sm:self-center">
                                            Created {req.created_at ? new Date(req.created_at).toLocaleString() : ''}
                                            {req.buyer_response_at && (
                                                <div>Buyer responded {new Date(req.buyer_response_at).toLocaleString()}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</div>
                )}
            </div>
        </div>
    );
}

export default SchedulePurchasePage;



