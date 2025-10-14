function SellerDashboardPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header with Create New Listing button */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-6 flex justify-end">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create New Listing
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SellerDashboardPage;
