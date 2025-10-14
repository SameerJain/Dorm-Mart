import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Landing-style hero using the same blue as navbar */}
      <section className="px-4 pt-6">
        <div className="mx-auto w-full max-w-6xl rounded-2xl bg-blue-600 px-6 py-8 md:px-10 md:py-10 text-center flex flex-col items-center justify-center">
          <h1 className="mb-3 text-white font-bold text-4xl sm:text-5xl md:text-6xl leading-tight">
            Welcome to Dorm Mart
          </h1>
          <p className="text-slate-100 text-lg sm:text-2xl md:text-3xl max-w-prose">
            Find what you need
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Your Dashboard</h2>
          <p className="text-gray-600 mb-6">
            You've successfully logged in! This is your main dashboard where you can manage your dorm essentials.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              to="/app/purchase-history"
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
