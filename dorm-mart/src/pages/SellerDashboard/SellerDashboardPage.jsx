import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

function SellerDashboardPage() {
    const navigate = useNavigate();
    const [selectedStatus, setSelectedStatus] = useState('All Status');
    const [selectedSort, setSelectedSort] = useState('Newest First');
    const [listings, setListings] = useState([]); // Will hold product listings from backend
    const [loading, setLoading] = useState(false); // Loading state for API calls

    const handleCreateNewListing = () => {
        navigate('/app/product-listing/new');
    };

    // Load listings on component mount
    useEffect(() => {
        fetchListings();
    }, []);

    // Function to filter listings based on selected status
    // Note: Current transacted_items table doesn't have status column
    // This will work when status column is added to the database
    const getFilteredListings = () => {
        if (selectedStatus === 'All Status') {
            return listings;
        }
        // For now, return all listings since status column doesn't exist yet
        // TODO: Implement actual status filtering when status column is added
        return listings;
    };

    // Function to sort listings based on selected sort option
    const getSortedListings = () => {
        const filtered = getFilteredListings();
        switch (selectedSort) {
            case 'Newest First':
                return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            case 'Oldest First':
                return [...filtered].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            case 'Price: Low to High':
                return [...filtered].sort((a, b) => a.price - b.price);
            case 'Price: High to Low':
                return [...filtered].sort((a, b) => b.price - a.price);
            default:
                return filtered;
        }
    };

    // Fetch seller's listings from backend - aligns with existing transacted_items table
    const fetchListings = async () => {
        setLoading(true);
        try {
            const BASE = (process.env.REACT_APP_API_BASE || "/api");
            // TODO: Create seller-listings.php endpoint similar to fetch-transacted-items.php
            // This will query transacted_items WHERE seller_user_id = current_user_id
            const response = await fetch(`${BASE}/seller-listings.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({}) // May need user_id or session token
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            
            if (result.success) {
                // Transform backend data to match frontend expectations
                const transformedListings = result.data.map(item => ({
                    id: item.id,
                    title: item.title,
                    price: item.price || 0, // May need to add price column to transacted_items
                    status: item.status || 'active', // May need to add status column
                    createdAt: item.transacted_at,
                    image: item.image_url,
                    sold_by: item.sold_by,
                    buyer_user_id: item.buyer_user_id,
                    seller_user_id: item.seller_user_id
                }));
                setListings(transformedListings);
            } else {
                throw new Error(result.error || 'Failed to fetch listings');
            }
        } catch (error) {
            console.error('Error fetching listings:', error);
            setListings([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Filter/Sort Row */}
            <div className="bg-gray-50 border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-4 flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-gray-700 w-24">{selectedStatus}</label>
                            <select 
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="bg-white border-2 border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-0 focus:border-blue-500"
                            >
                                <option value="All Status">All Status</option>
                                <option value="Active">Active</option>
                                <option value="Draft">Draft</option>
                                <option value="Sold">Sold</option>
                                <option value="Removed">Removed</option>
                            </select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-gray-700 w-32">All Categories</label>
                            <select className="bg-white border-2 border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-0 focus:border-blue-500">
                                <option>All Categories</option>
                            </select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-gray-700 w-32">{selectedSort}</label>
                            <select 
                                value={selectedSort}
                                onChange={(e) => setSelectedSort(e.target.value)}
                                className="bg-white border-2 border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-0 focus:border-blue-500"
                            >
                                <option value="Newest First">Newest First</option>
                                <option value="Oldest First">Oldest First</option>
                                <option value="Price: Low to High">Price: Low to High</option>
                                <option value="Price: High to Low">Price: High to Low</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Header with Create New Listing button */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-6 flex justify-end">
                        <button 
                            onClick={handleCreateNewListing}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create New Listing
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h2 className="text-4xl font-bold text-gray-900 mb-6">My Listings</h2>
                
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500 text-lg">Loading listings...</p>
                    </div>
                ) : getSortedListings().length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No products posted yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* TODO: Replace with actual listing cards */}
                        {getSortedListings().map((listing) => (
                            <div key={listing.id} className="bg-white rounded-lg shadow-sm border p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                                            {listing.image ? (
                                                <img src={listing.image} alt={listing.title} className="w-full h-full object-cover rounded-lg" />
                                            ) : (
                                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-medium text-gray-900">{listing.title}</h3>
                                            {listing.price > 0 && <p className="text-gray-600">${listing.price}</p>}
                                            <p className="text-sm text-gray-500">
                                                {listing.sold_by ? `Sold by ${listing.sold_by}` : 'Posted'} - {new Date(listing.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            listing.buyer_user_id 
                                                ? 'bg-blue-100 text-blue-800' // Sold/transacted
                                                : 'bg-green-100 text-green-800' // Active listing
                                        }`}>
                                            {listing.buyer_user_id ? 'Sold' : 'Active'}
                                        </span>
                                        <button 
                                            onClick={() => navigate(`/app/product-listing/edit/${listing.id}`)}
                                            className="text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default SellerDashboardPage;
