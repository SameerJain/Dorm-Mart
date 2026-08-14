import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ExploreSection from "./components/ExploreSection";
import ForYouSection from "./components/ForYouSection";
import HomeFeedTabs from "./components/HomeFeedTabs";
import HomeTopBar from "./components/HomeTopBar";
import { useHomeFeed } from "./hooks/useHomeFeed";

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeTab,
    errorItems,
    errorUser,
    exploreItems,
    forYouItems,
    hasPersonalization,
    interests,
    isLoading,
    quickFilterCategories,
    selectTab,
    wishlistedIds,
  } = useHomeFeed();
  const [isMobile, setIsMobile] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [showLoginSuccess, setShowLoginSuccess] = useState(
    Boolean(location.state?.loginSuccess),
  );

  const rotatingLines = isMobile
    ? ["Happy Shopping!"]
    : ["Welcome to Dorm Mart!", "Happy Shopping!"];
  const openExternalRoute = (url) => {
    window.location.href = url;
  };

  useEffect(() => {
    if (!location.state?.loginSuccess) return undefined;
    const id = setTimeout(() => {
      setShowLoginSuccess(false);
      navigate(location.pathname, { replace: true, state: null });
    }, 3000);
    return () => clearTimeout(id);
  }, [location.pathname, location.state?.loginSuccess, navigate]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const id = setInterval(
      () => setBannerIdx((previous) => (previous + 1) % rotatingLines.length),
      4000,
    );
    return () => clearInterval(id);
  }, [rotatingLines.length]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {showLoginSuccess && (
        <div role="status" className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-lg bg-green-600 px-5 py-3 font-medium text-white shadow-lg">
          Login Successful.
        </div>
      )}
      <HomeTopBar
        bannerText={rotatingLines[bannerIdx]}
        interests={interests}
        navigate={navigate}
        openExternalRoute={openExternalRoute}
      />

      <HomeFeedTabs
        activeTab={activeTab}
        navigate={navigate}
        onSelectTab={selectTab}
        openExternalRoute={openExternalRoute}
        quickFilterCategories={quickFilterCategories}
      />

      <div className="w-full flex-1 px-1 sm:px-2 md:px-3 py-5 pb-10">
        <div className="grid grid-cols-1 gap-3 items-start">
          <main className="flex flex-col gap-6 min-w-0">
            {activeTab === "forYou" && (
              <ForYouSection
                hasPersonalization={hasPersonalization}
                items={forYouItems}
                navigate={navigate}
                wishlistedIds={wishlistedIds}
              />
            )}

            {activeTab === "explore" && (
              <ExploreSection
                items={exploreItems}
                wishlistedIds={wishlistedIds}
              />
            )}

            <div className="space-y-1">
              {isLoading && (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500">
                  Loading your feed...
                </p>
              )}
              {errorUser && (
                <p className="text-center text-sm text-red-500">
                  Couldn't load your preferences - showing general items.
                </p>
              )}
              {errorItems && (
                <p className="text-center text-sm text-red-500">
                  Couldn't load latest listings. Showing sample items.
                </p>
              )}
            </div>
          </main>
        </div>
      </div>

    </div>
  );
}
