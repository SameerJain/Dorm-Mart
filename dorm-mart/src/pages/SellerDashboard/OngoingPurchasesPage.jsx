import { useEffect, useState } from 'react';

const API_BASE = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');

function OngoingPurchasesPage() {
    const [buyerRequests, setBuyerRequests] = useState([]);
    const [sellerRequests, setSellerRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [actionMessage, setActionMessage] = useState('');
    const [actionError, setActionError] = useState('');
    const [busyRequestId, setBusyRequestId] = useState(0);

    useEffect(() => {
        const abort = new AbortController();
        async function load() {
            setLoading(true);
            setError('');
            try {
                // Load both buyer and seller requests
                const [buyerRes, sellerRes] = await Promise.all([
                    fetch(`${API_BASE}/scheduled-purchases/list_buyer.php`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        credentials: 'include',
                        signal: abort.signal,
                    }),
                    fetch(`${API_BASE}/scheduled-purchases/list_seller.php`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        credentials: 'include',
                        signal: abort.signal,
                    })
                ]);

                if (!buyerRes.ok || !sellerRes.ok) {
                    throw new Error(`HTTP ${buyerRes.status} or ${sellerRes.status}`);
                }

                const buyerPayload = await buyerRes.json();
                const sellerPayload = await sellerRes.json();

                if (!buyerPayload.success || !sellerPayload.success) {
                    throw new Error(buyerPayload.error || sellerPayload.error || 'Failed to load ongoing purchases');
                }

                setBuyerRequests(Array.isArray(buyerPayload.data) ? buyerPayload.data : []);
                setSellerRequests(Array.isArray(sellerPayload.data) ? sellerPayload.data : []);
            } catch (e) {
                if (e.name !== 'AbortError') {
                    setError('Unable to load your scheduled purchases right now.');
                }
            } finally {
                setLoading(false);
            }
        }

        load();
        return () => abort.abort();
    }, []);

    async function refresh() {
        setLoading(true);
        setError('');
        try {
            const [buyerRes, sellerRes] = await Promise.all([
                fetch(`${API_BASE}/scheduled-purchases/list_buyer.php`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                }),
                fetch(`${API_BASE}/scheduled-purchases/list_seller.php`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                })
            ]);

            if (!buyerRes.ok || !sellerRes.ok) {
                throw new Error('HTTP error');
            }

            const buyerPayload = await buyerRes.json();
            const sellerPayload = await sellerRes.json();

            if (!buyerPayload.success || !sellerPayload.success) {
                throw new Error('Failed to refresh');
            }

            setBuyerRequests(Array.isArray(buyerPayload.data) ? buyerPayload.data : []);
            setSellerRequests(Array.isArray(sellerPayload.data) ? sellerPayload.data : []);
        } catch (e) {
            setError('Unable to refresh scheduled purchases.');
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(requestId, action) {
        setBusyRequestId(requestId);
        setActionMessage('');
        setActionError('');
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
                    action,
                }),
            });
            if (!res.ok) {
                const msg = action === 'accept' ? 'Failed to accept request' : 'Failed to decline request';
                throw new Error(msg);
            }
            const payload = await res.json();
            if (!payload.success) {
                throw new Error(payload.error || 'Action failed');
            }

            const updated = payload.data;
            // Update in buyer requests
            setBuyerRequests((prev) => prev.map((req) => {
                if (req.request_id !== requestId) return req;
                return {
                    ...req,
                    status: updated.status || req.status,
                    buyer_response_at: updated.buyer_response_at || new Date().toISOString(),
                    meeting_at: updated.meeting_at || req.meeting_at,
                    meet_location: updated.meet_location || req.meet_location,
                    verification_code: updated.verification_code || req.verification_code,
                };
            }));
            // Also refresh seller requests to get updated status
            const sellerRes = await fetch(`${API_BASE}/scheduled-purchases/list_seller.php`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include',
            });
            if (sellerRes.ok) {
                const sellerPayload = await sellerRes.json();
                if (sellerPayload.success) {
                    setSellerRequests(Array.isArray(sellerPayload.data) ? sellerPayload.data : []);
                }
            }
            setActionMessage(action === 'accept' ? 'Purchase accepted. Be sure to share the verification code when you meet.' : 'Purchase declined.');
        } catch (e) {
            setActionError(e.message || 'Something went wrong.');
        } finally {
            setBusyRequestId(0);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Ongoing Purchases</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">
                        Review scheduled meetup requests from sellers. Accept to confirm the plan or decline if it does not work for you.
                    </p>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Pending &amp; Confirmed Requests</h2>
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={loading}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {actionMessage && (
                    <div className="mb-4 text-sm text-green-600 dark:text-green-400">{actionMessage}</div>
                )}
                {actionError && (
                    <div className="mb-4 text-sm text-red-600 dark:text-red-400">{actionError}</div>
                )}

                {loading ? (
                    <div className="text-gray-600 dark:text-gray-300">Loading scheduled purchases...</div>
                ) : buyerRequests.length === 0 && sellerRequests.length === 0 ? (
                    <div className="text-gray-600 dark:text-gray-400">You have no scheduled purchases yet.</div>
                ) : (
                    <div className="space-y-6">
                        {/* Buyer Requests Section */}
                        {buyerRequests.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">As Buyer</h3>
                                <div className="space-y-4">
                                    {buyerRequests.map((req) => {
                                        const meetingDate = req.meeting_at ? new Date(req.meeting_at).toLocaleString() : 'Not provided';
                                        const code = req.verification_code || '----';
                                        const canRespond = req.status === 'pending';

                                        return (
                                            <div key={`buyer-${req.request_id}`} className="bg-white dark:bg-gray-800 border-2 border-green-500 dark:border-green-600 rounded-lg p-5 shadow-sm">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">You are the Buyer</span>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                                            Requested {req.created_at ? new Date(req.created_at).toLocaleString() : ''}
                                                            {req.buyer_response_at && (
                                                                <div>You responded {new Date(req.buyer_response_at).toLocaleString()}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                        <div>
                                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{req.item?.title || 'Listing'}</h3>
                                                            <p className="text-sm text-gray-600 dark:text-gray-300">Seller: {req.seller?.first_name} {req.seller?.last_name}</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-200">
                                                        <div>
                                                            <span className="font-semibold">Location:</span> {req.meet_location || 'Not provided'}
                                                        </div>
                                                        <div>
                                                            <span className="font-semibold">Meeting Time:</span> {meetingDate}
                                                        </div>
                                                    </div>
                                                    {req.description && (
                                                        <div className="text-sm text-gray-700 dark:text-gray-200">
                                                            <span className="font-semibold">Description:</span> {req.description}
                                                        </div>
                                                    )}
                                                    <div className="text-sm text-gray-700 dark:text-gray-200">
                                                        <span className="font-semibold">Verification Code:</span>{' '}
                                                        <span className={`font-mono text-base ${req.status === 'accepted' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>{code}</span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 justify-end pt-2">
                                                        {canRespond ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAction(req.request_id, 'decline')}
                                                                    disabled={busyRequestId === req.request_id}
                                                                    className="px-4 py-2 text-sm font-medium rounded-lg border border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-60"
                                                                >
                                                                    {busyRequestId === req.request_id && actionError ? 'Retry Decline' : 'Decline'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAction(req.request_id, 'accept')}
                                                                    disabled={busyRequestId === req.request_id}
                                                                    className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                                                >
                                                                    {busyRequestId === req.request_id && !actionError ? 'Processing...' : 'Accept'}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Request {req.status}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Seller Requests Section */}
                        {sellerRequests.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">As Seller</h3>
                                <div className="space-y-4">
                                    {sellerRequests.map((req) => {
                                        const meetingDate = req.meeting_at ? new Date(req.meeting_at).toLocaleString() : 'Not provided';
                                        const code = req.verification_code || '----';
                                        const canCancel = req.status === 'pending' || req.status === 'accepted';

                                        return (
                                            <div key={`seller-${req.request_id}`} className="bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-600 rounded-lg p-5 shadow-sm">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">You are the Seller</span>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                                            Created {req.created_at ? new Date(req.created_at).toLocaleString() : ''}
                                                            {req.buyer_response_at && (
                                                                <div>Buyer responded {new Date(req.buyer_response_at).toLocaleString()}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                        <div>
                                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{req.item?.title || 'Listing'}</h3>
                                                            <p className="text-sm text-gray-600 dark:text-gray-300">Buyer: {req.buyer?.first_name} {req.buyer?.last_name}</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-200">
                                                        <div>
                                                            <span className="font-semibold">Location:</span> {req.meet_location || 'Not provided'}
                                                        </div>
                                                        <div>
                                                            <span className="font-semibold">Meeting Time:</span> {meetingDate}
                                                        </div>
                                                    </div>
                                                    {req.description && (
                                                        <div className="text-sm text-gray-700 dark:text-gray-200">
                                                            <span className="font-semibold">Description:</span> {req.description}
                                                        </div>
                                                    )}
                                                    <div className="text-sm text-gray-700 dark:text-gray-200">
                                                        <span className="font-semibold">Verification Code:</span>{' '}
                                                        <span className={`font-mono text-base ${req.status === 'accepted' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>{code}</span>
                                                    </div>
                                                    <div className="text-sm text-gray-700 dark:text-gray-200">
                                                        <span className="font-semibold">Status:</span>{' '}
                                                        <span className={`font-medium ${
                                                            req.status === 'accepted' ? 'text-green-600 dark:text-green-400' :
                                                            req.status === 'declined' ? 'text-red-600 dark:text-red-400' :
                                                            req.status === 'cancelled' ? 'text-orange-600 dark:text-orange-400' :
                                                            'text-blue-600 dark:text-blue-400'
                                                        }`}>
                                                            {req.status}
                                                        </span>
                                                    </div>

                                                    {canCancel && (
                                                        <div className="flex flex-wrap gap-2 justify-end pt-2">
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    setBusyRequestId(req.request_id);
                                                                    setActionError('');
                                                                    try {
                                                                        const res = await fetch(`${API_BASE}/scheduled-purchases/cancel.php`, {
                                                                            method: 'POST',
                                                                            headers: {
                                                                                'Content-Type': 'application/json',
                                                                                'Accept': 'application/json',
                                                                            },
                                                                            credentials: 'include',
                                                                            body: JSON.stringify({
                                                                                request_id: req.request_id,
                                                                            }),
                                                                        });
                                                                        if (!res.ok) {
                                                                            throw new Error('Failed to cancel request');
                                                                        }
                                                                        const payload = await res.json();
                                                                        if (!payload.success) {
                                                                            throw new Error(payload.error || 'Failed to cancel');
                                                                        }
                                                                        await refresh();
                                                                        setActionMessage('Purchase request cancelled successfully.');
                                                                    } catch (e) {
                                                                        setActionError(e.message || 'Something went wrong.');
                                                                    } finally {
                                                                        setBusyRequestId(0);
                                                                    }
                                                                }}
                                                                disabled={busyRequestId === req.request_id}
                                                                className="px-4 py-2 text-sm font-medium rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
                                                            >
                                                                {busyRequestId === req.request_id ? 'Cancelling...' : 'Cancel'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</div>
                )}
            </div>
        </div>
    );
}

export default OngoingPurchasesPage;


