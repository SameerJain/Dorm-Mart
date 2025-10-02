import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Welcome to Dorm Mart</h1>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Your Dashboard</h2>
          <p className="text-gray-600 mb-6">
            You've successfully logged in! This is your main dashboard where you can manage your dorm essentials.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link 
              to="/purchase-history" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg text-center transition-colors"
            >
              View Purchase History
            </Link>
            
            <div className="bg-gray-100 px-6 py-4 rounded-lg text-center">
              <p className="text-gray-600">More features coming soon!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
