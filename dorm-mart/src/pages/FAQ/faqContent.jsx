import ChatFAQ from "./ChatFAQ";
import HomeFAQ from "./HomeFAQ";
import NotificationsFAQ from "./NotificationsFAQ";
import ProfileFAQ from "./ProfileFAQ";
import PurchasesFAQ from "./PurchasesFAQ";
import ReviewsFAQ from "./ReviewsFAQ";
import SellerDashboardFAQ from "./SellerDashboardFAQ";
import SettingsFAQ from "./SettingsFAQ";
import WishlistFAQ from "./WishlistFAQ";

export const FAQ_CONTENT = {
  home: <HomeFAQ />,
  wishlist: <WishlistFAQ />,
  chat: <ChatFAQ />,
  purchases: <PurchasesFAQ />,
  reviews: <ReviewsFAQ />,
  seller: <SellerDashboardFAQ />,
  notifications: <NotificationsFAQ />,
  profile: <ProfileFAQ />,
  settings: <SettingsFAQ />,
};
