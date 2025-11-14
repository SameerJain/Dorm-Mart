import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import chatIcon from '../../assets/icons/icons8-chat-96.png'
import userIcon from '../../assets/icons/icons8-user-icon-96.png'
import notificationIcon from '../../assets/icons/icons8-notification-96.png'
import settingIcon from '../../assets/icons/icons8-setting-96.png'
import Icon from './Icon'
import searchIcon from '../../assets/icons/icons8-search-96.png';
// filter icon removed; filters move to search page
import { logout } from '../../utils/handle_auth';
import { ChatContext } from "../../context/ChatContext";
import { useContext } from 'react';

function MainNav() {
    const [showDropdown, setShowDropdown] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showMobileUserDropdown, setShowMobileUserDropdown] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);
    const mobileMenuRef = useRef(null);
    // no filter panel in nav
    const location = useLocation();

    const ctx = useContext(ChatContext);
    const { unreadMsgTotal, unreadNotificationTotal } = ctx;
    // no filters state in nav

    // Close dropdowns/menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
            if (
                mobileMenuRef.current &&
                !mobileMenuRef.current.contains(event.target)
            ) {
                setShowMobileMenu(false);
                setShowMobileUserDropdown(false);
            }
            // no filter panel to close
        };

        if (showDropdown || showMobileMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showDropdown, showMobileMenu]);

    const handleLogout = async () => {
        // Call backend to clear server-side auth
        await logout();
        // Redirect to login page
        navigate("/login");
    };

    const handlePurchaseHistory = () => {
        navigate("/app/purchase-history");
    };

    const handleSellerDashboard = () => {
        navigate("/app/seller-dashboard");
    };

    const handleSchedulePurchase = () => {
        navigate("/app/seller-dashboard/schedule-purchase");
    };

    const handleOngoingPurchases = () => {
        navigate("/app/seller-dashboard/ongoing-purchases");
    };

    const handleWishlist = () => {
        navigate("/app/wishlist");
    };

    // Search state + handlers
    const [searchText, setSearchText] = useState("");
    const inputRef = useRef(null);

    const handleSearchSubmit = (value) => {
        const term = (value || "").trim();
        // Determine include-description preference from current URL or localStorage
        let includeDesc = false;
        try {
            const spCurrent = new URLSearchParams(location.search || "");
            const qDesc = spCurrent.get('desc') || spCurrent.get('includeDescription');
            if (qDesc && (qDesc === '1' || qDesc === 'true')) {
                includeDesc = true;
            } else {
                includeDesc = (localStorage.getItem('dm_include_desc') === '1');
            }
        } catch (_) {}

        const sp = new URLSearchParams();
        if (term) sp.set('search', term);
        if (includeDesc) sp.set('desc', '1');
        // Navigate to listings; allow empty term to show all
        const qs = sp.toString();
        navigate(qs ? `/app/listings?${qs}` : "/app/listings");
    };

    return (
        <nav className="bg-blue-600 text-slate-100 dark:bg-gray-800 dark:text-gray-100">
            <div className="mx-auto flex items-center gap-1 sm:gap-2 md:gap-4 p-2 md:p-3">
                <button
                    onClick={() => navigate("/app")}
                    className="ml-1 sm:ml-2 md:ml-4 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif font-semibold cursor-pointer hover:scale-105 hover:opacity-90 hover:drop-shadow-lg transition-all duration-200 bg-transparent border-none p-0 text-slate-100 whitespace-nowrap flex-shrink-0"
                >
                    Dorm Mart
                </button>
                <div className="flex-1 mx-1 sm:mx-2 md:mx-3 lg:mx-5 min-w-0">
                    <div className="flex h-12 md:h-15 items-center overflow-hidden rounded-full bg-white shadow-inner">
                        {/* Search icon */}
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleSearchSubmit(searchText); }}
                            className="flex h-full w-10 sm:w-12 md:w-16 lg:w-20 items-center justify-center border-r border-slate-200 border-black flex-shrink-0"
                        >
                            <img
                                src={searchIcon}
                                alt=""
                                className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8"
                            />
                        </button>

                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchText}
                            ref={inputRef}
                            onChange={(e) => setSearchText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSearchSubmit(searchText);
                                }
                            }}
                            className="h-full w-full px-2 sm:px-3 text-sm md:text-base text-slate-900 placeholder-slate-400 focus:outline-none min-w-0"
                        />

                        {/* Clear button shows only when text present */}
                        {searchText ? (
                            <button
                                type="button"
                                onClick={() => { setSearchText(""); inputRef.current?.focus(); }}
                                aria-label="Clear search"
                                className="px-3 h-full text-slate-500 hover:text-slate-700"
                            >
                                ×
                            </button>
                        ) : null}

                        {/* filter icon and panel removed; filters live on search page */}
                    </div>
                </div>

                {/* Desktop navigation - hidden on mobile */}
                <ul className="mr-1 sm:mr-2 hidden md:flex items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 flex-shrink-0">
                    <Icon to="/app/notification" src={notificationIcon} alt="Notification" badge={unreadNotificationTotal} />

                    <Icon to="/app/chat" src={chatIcon} alt="Chat" badge={unreadMsgTotal} />

                    {/* User icon with dropdown */}
                    <li className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="block"
                        >
                            <img
                                src={userIcon}
                                alt="User Selection"
                                className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10"
                            />
                        </button>

                        {/* Dropdown menu */}
                        {showDropdown && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg py-2 z-50">
                                <button
                                    onClick={() => { handleSellerDashboard(); setShowDropdown(false); }}
                                    className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Seller Dashboard
                                </button>
                                <button
                                    onClick={() => { handleWishlist(); setShowDropdown(false); }}
                                    className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                    My Wishlist
                                </button>
                                <button
                                    onClick={() => { handleOngoingPurchases(); setShowDropdown(false); }}
                                    className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Ongoing Purchases
                                </button>
                                <button
                                    onClick={() => { handlePurchaseHistory(); setShowDropdown(false); }}
                                    className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Purchase History
                                </button>
                                <button
                                    onClick={() => { handleLogout(); setShowDropdown(false); }}
                                    className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Log Out
                                </button>
                            </div>
                        )}
                    </li>

                    <Icon to="/app/setting" src={settingIcon} alt="Setting" />
                </ul>

                {/* Mobile hamburger menu - visible only on mobile */}
                <div className="mr-2 md:hidden relative" ref={mobileMenuRef}>
                    <button
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        className="flex flex-col justify-center items-center w-8 h-8 gap-1.5"
                        aria-label="Menu"
                    >
                        <span className="w-6 h-0.5 bg-white"></span>
                        <span className="w-6 h-0.5 bg-white"></span>
                        <span className="w-6 h-0.5 bg-white"></span>
                    </button>

                    {/* Mobile menu dropdown */}
                    {showMobileMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-blue-600 rounded-lg shadow-lg py-2 z-50 border-2 border-blue-400">
                            <button
                                onClick={() => {
                                    navigate("/app/notification");
                                    setShowMobileMenu(false);
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <span className="relative inline-block">
                                    <img src={notificationIcon} alt="" className="h-6 w-6" />
                                    {unreadNotificationTotal > 0 && (
                                        <span
                                            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center"
                                            aria-label={`${unreadNotificationTotal} unread notifications`}
                                        >
                                            {unreadNotificationTotal > 99 ? "99+" : unreadNotificationTotal}
                                        </span>
                                    )}
                                </span>
                                <span>Notification</span>
                            </button>

                            <button
                                onClick={() => {
                                    navigate("/app/chat");
                                    setShowMobileMenu(false);
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                {/* relative wrapper so the badge can be positioned on the icon */}
                                <span className="relative inline-block">
                                    <img src={chatIcon} alt="" className="h-6 w-6" />
                                    {unreadMsgTotal > 0 && (
                                    <span
                                        className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center"
                                        aria-label={`${unreadMsgTotal} unread`}
                                    >
                                        {unreadMsgTotal > 99 ? "99+" : unreadMsgTotal}
                                    </span>
                                    )}
                                </span>
                                <span>Chat</span>
                            </button>
                            <button
                                onClick={() => {
                                    handleSellerDashboard();
                                    setShowMobileMenu(false);
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <img src={userIcon} alt="" className="h-6 w-6" />
                                <span>Seller Dashboard</span>
                            </button>
                            <button
                                onClick={() => {
                                    handleWishlist();
                                    setShowMobileMenu(false);
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <img src={userIcon} alt="" className="h-6 w-6" />
                                <span>My Wishlist</span>
                            </button>
                            <button
                                onClick={() => {
                                    handleOngoingPurchases();
                                    setShowMobileMenu(false);
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <img src={userIcon} alt="" className="h-6 w-6" />
                                <span>Ongoing Purchases</span>
                            </button>
                            <button
                                onClick={() => {
                                    handlePurchaseHistory();
                                    setShowMobileMenu(false);
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <img src={userIcon} alt="" className="h-6 w-6" />
                                <span>Purchase History</span>
                            </button>
                            <div className="relative">
                                <button
                                    onClick={() =>
                                        setShowMobileUserDropdown(!showMobileUserDropdown)
                                    }
                                    className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                                >
                                    <img src={userIcon} alt="" className="h-6 w-6" />
                                    <span>User Profile</span>
                                </button>
                                {/* Nested dropdown for logout */}
                                {showMobileUserDropdown && (
                                    <div className="mt-1 mx-2 bg-blue-500 rounded-md shadow-inner">
                                        <button
                                            onClick={() => {
                                                handleLogout();
                                                setShowMobileMenu(false);
                                                setShowMobileUserDropdown(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-white hover:bg-blue-700 transition-colors rounded-md"
                                        >
                                            Log Out
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    navigate("/app/setting");
                                    setShowMobileMenu(false);
                                }}
                                className="w-full text-left px-4 py-3 text-white hover:bg-blue-700 transition-colors flex items-center gap-3"
                            >
                                <img src={settingIcon} alt="" className="h-6 w-6" />
                                <span>Settings</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default MainNav;
