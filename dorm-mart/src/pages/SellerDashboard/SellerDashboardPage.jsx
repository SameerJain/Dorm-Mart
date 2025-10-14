import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

function SellerDashboardPage() {
    const navigate = useNavigate();
    const [selectedStatus, setSelectedStatus] = useState('All Status');
    const [selectedSort, setSelectedSort] = useState('Newest First');
    const [listings, setListings] = useState([]); // Will hold product listings from backend
    const [loading, setLoading] = useState(false); // Loading state for API calls
    
    // Summary metrics state - will be calculated from listings data
    const [summaryMetrics, setSummaryMetrics] = useState({
        activeListings: 0,
        pendingSales: 0,
        itemsSold: 0,
        savedDrafts: 0,
        totalViews: 0
    });

    const handleCreateNewListing = () => {
        navigate('/app/product-listing/new');
    };

    // Calculate summary metrics from listings data
    const calculateSummaryMetrics = (listingsData) => {
        const metrics = {
            activeListings: 0,
            pendingSales: 0,
            itemsSold: 0,
            savedDrafts: 0,
            totalViews: 0
        };

        listingsData.forEach(listing => {
            // Count active listings (no buyer_user_id and status is not 'draft' or 'removed')
            if (!listing.buyer_user_id && listing.status !== 'draft' && listing.status !== 'removed') {
                metrics.activeListings++;
            }
            
            // Count pending sales (has buyer_user_id but not completed)
            if (listing.buyer_user_id && listing.status === 'pending') {
                metrics.pendingSales++;
            }
            
            // Count sold items (has buyer_user_id and status is 'sold')
            if (listing.buyer_user_id && listing.status === 'sold') {
                metrics.itemsSold++;
            }
            
            // Count saved drafts (status is 'draft')
            if (listing.status === 'draft') {
                metrics.savedDrafts++;
            }
            
            // Total views - for now set to 0, will be calculated from backend when view tracking is implemented
            // metrics.totalViews += listing.views || 0;
        });

        return metrics;
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
                    price: item.price || 0,
                    status: item.status || 'active',
                    createdAt: item.created_at, // Use correct field name
                    image: item.image_url,
                    seller_user_id: item.seller_user_id,
                    buyer_user_id: item.buyer_user_id
                }));
                setListings(transformedListings);
                
                // Calculate and set summary metrics
                const metrics = calculateSummaryMetrics(transformedListings);
                setSummaryMetrics(metrics);
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
                    <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                        <div className="flex items-center w-full sm:w-auto">
                            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Status</label>
                            <div className="relative ml-1 flex-1 sm:flex-none">
                                <select 
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                                >
                                    <option value="All Status">All Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Draft">Draft</option>
                                    <option value="Sold">Sold</option>
                                    <option value="Removed">Removed</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center w-full sm:w-auto">
                            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Category</label>
                            <div className="relative ml-1 flex-1 sm:flex-none">
                                <select className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer">
                                    <option>All Categories</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center w-full sm:w-auto">
                            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Sort By</label>
                            <div className="relative ml-1 flex-1 sm:flex-none">
                                <select 
                                    value={selectedSort}
                                    onChange={(e) => setSelectedSort(e.target.value)}
                                    className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                                >
                                    <option value="Newest First">Newest First</option>
                                    <option value="Oldest First">Oldest First</option>
                                    <option value="Price: Low to High">Price: Low to High</option>
                                    <option value="Price: High to Low">Price: High to Low</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Summary Box */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-blue-600 rounded-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    {/* Statistics Title */}
                    <div className="text-white">
                        <h3 className="text-2xl font-bold">Statistics</h3>
                    </div>
                    
                    {/* Metrics - Original Layout on Desktop, Grid on Mobile */}
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-12 md:flex-1 md:justify-center">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{summaryMetrics.activeListings}</div>
                            <div className="text-sm text-blue-100">Active Listings</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{summaryMetrics.pendingSales}</div>
                            <div className="text-sm text-blue-100">Pending Sales</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{summaryMetrics.itemsSold}</div>
                            <div className="text-sm text-blue-100">Items Sold</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{summaryMetrics.savedDrafts}</div>
                            <div className="text-sm text-blue-100">Saved Drafts</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white">{summaryMetrics.totalViews}</div>
                            <div className="text-sm text-blue-100">Total Views</div>
                        </div>
                    </div>
                    
                    {/* Create New Listing Button */}
                    <button 
                        onClick={handleCreateNewListing}
                        className="w-full md:w-auto bg-white hover:bg-gray-50 text-blue-600 px-8 py-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-3 border-2 border-blue-600 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create New Listing
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4 sm:mb-6">My Listings</h2>
                
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
                            <div key={listing.id} className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex items-center space-x-3 sm:space-x-4">
                                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                            {listing.image ? (
                                                <img src={listing.image} alt={listing.title} className="w-full h-full object-cover rounded-lg" />
                                            ) : (
                                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">{listing.title}</h3>
                                            {listing.price > 0 && <p className="text-sm sm:text-base text-gray-600">${listing.price}</p>}
                                            <p className="text-xs sm:text-sm text-gray-500">
                                                {listing.sold_by ? `Sold by ${listing.sold_by}` : 'Posted'} - {new Date(listing.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end space-x-3">
                                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                                            listing.buyer_user_id 
                                                ? 'bg-blue-100 text-blue-800' // Sold/transacted
                                                : 'bg-green-100 text-green-800' // Active listing
                                        }`}>
                                            {listing.buyer_user_id ? 'Sold' : 'Active'}
                                        </span>
                                        <button 
                                            onClick={() => navigate(`/app/product-listing/edit/${listing.id}`)}
                                            className="text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base"
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