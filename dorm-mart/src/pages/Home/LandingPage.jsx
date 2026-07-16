import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ExploreSection from "./components/ExploreSection";
import ForYouHintModal from "./components/ForYouHintModal";
import ForYouSection from "./components/ForYouSection";
import HomeFeedTabs from "./components/HomeFeedTabs";
import HomeTopBar from "./components/HomeTopBar";
import { useHomeFeed } from "./hooks/useHomeFeed";

const FOR_YOU_HINT_SESSION_KEY = "dm_for_you_feed_hint_dismissed";
const FOR_YOU_HINT_FADE_MS = 280;

export default function LandingPage() {
  const navigate = useNavigate();
  const {
    activeTab,
    errorItems,
    errorUser,
    exploreItems,
    interests,
    isLoading,
    itemsByInterest,
    loadingUser,
    quickFilterCategories,
    selectTab,
    wishlistedIds,
  } = useHomeFeed();
  const [forYouHintDismissed, setForYouHintDismissed] = useState(true);
  const [forYouHintAppeared, setForYouHintAppeared] = useState(false);
  const [forYouHintClosing, setForYouHintClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const forYouHintCloseGuardRef = useRef(false);
  const forYouHintLeaveTimerRef = useRef(null);

  const rotatingLines = isMobile
    ? ["Happy Shopping!"]
    : ["Welcome to Dorm Mart!", "Happy Shopping!"];
  const hintWantsDisplay =
    !loadingUser && !interests.length && !forYouHintDismissed;
  const showForYouHintOverlay = hintWantsDisplay || forYouHintClosing;
  const forYouHintFullyVisible = forYouHintAppeared && !forYouHintClosing;

  const openExternalRoute = (url) => {
    window.location.href = url;
  };

  const dismissForYouHint = useCallback(() => {
    setForYouHintDismissed(true);
    try {
      sessionStorage.setItem(FOR_YOU_HINT_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const reopenForYouHint = useCallback(() => {
    try {
      sessionStorage.removeItem(FOR_YOU_HINT_SESSION_KEY);
    } catch {
      /* ignore */
    }
    forYouHintCloseGuardRef.current = false;
    setForYouHintClosing(false);
    setForYouHintAppeared(false);
    setForYouHintDismissed(false);
  }, []);

  const closeForYouHintFade = useCallback(() => {
    if (forYouHintCloseGuardRef.current) return;
    forYouHintCloseGuardRef.current = true;
    setForYouHintClosing(true);
    if (forYouHintLeaveTimerRef.current) {
      clearTimeout(forYouHintLeaveTimerRef.current);
    }
    forYouHintLeaveTimerRef.current = setTimeout(() => {
      forYouHintLeaveTimerRef.current = null;
      forYouHintCloseGuardRef.current = false;
      dismissForYouHint();
      setForYouHintClosing(false);
    }, FOR_YOU_HINT_FADE_MS);
  }, [dismissForYouHint]);

  const navigateToPreferencesFromHint = () => {
    if (forYouHintLeaveTimerRef.current) {
      clearTimeout(forYouHintLeaveTimerRef.current);
      forYouHintLeaveTimerRef.current = null;
    }
    forYouHintCloseGuardRef.current = false;
    setForYouHintClosing(false);
    setForYouHintAppeared(false);
    dismissForYouHint();
  };

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

  useEffect(() => {
    if (!hintWantsDisplay) {
      forYouHintCloseGuardRef.current = false;
    }
  }, [hintWantsDisplay]);

  useEffect(() => {
    if (!hintWantsDisplay) {
      setForYouHintAppeared(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setForYouHintAppeared(true));
    });
    return () => cancelAnimationFrame(id);
  }, [hintWantsDisplay]);

  useEffect(() => {
    return () => {
      if (forYouHintLeaveTimerRef.current) {
        clearTimeout(forYouHintLeaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (showForYouHintOverlay) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [showForYouHintOverlay]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <HomeTopBar
        bannerText={rotatingLines[bannerIdx]}
        interests={interests}
        navigate={navigate}
        openExternalRoute={openExternalRoute}
      />

      <HomeFeedTabs
        activeTab={activeTab}
        interests={interests}
        navigate={navigate}
        onReopenForYouHint={reopenForYouHint}
        onSelectTab={selectTab}
        openExternalRoute={openExternalRoute}
        quickFilterCategories={quickFilterCategories}
      />

      <div className="w-full flex-1 px-1 sm:px-2 md:px-3 py-5 pb-10">
        <div className="grid grid-cols-1 gap-3 items-start">
          <main className="flex flex-col gap-6 min-w-0">
            {activeTab === "forYou" && (
              <ForYouSection
                interests={interests}
                itemsByInterest={itemsByInterest}
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

      {showForYouHintOverlay && (
        <ForYouHintModal
          fullyVisible={forYouHintFullyVisible}
          navigate={navigate}
          onClose={closeForYouHintFade}
          onNavigateToPreferences={navigateToPreferencesFromHint}
        />
      )}
    </div>
  );
}
