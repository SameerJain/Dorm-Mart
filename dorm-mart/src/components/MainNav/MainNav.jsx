import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import chatIcon from '../../assets/icons/icons8-chat-96.png'
import userIcon from '../../assets/icons/icons8-user-icon-96.png'
import notificationIcon from '../../assets/icons/icons8-notification-96.png'
import settingIcon from '../../assets/icons/icons8-setting-96.png'
import Icon from './Icon'
import searchIcon from '../../assets/icons/icons8-search-96.png';
import filterIcon from '../../assets/icons/icons8-filter-96.png';
import { removeAuthToken } from '../../utils/auth';

function MainNav() {
    const [showDropdown, setShowDropdown] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    const handleLogout = () => {
        // Remove auth_token cookie
        removeAuthToken();
        
        // Redirect to login page
        navigate('/login');
    };

    return (
        <nav className="bg-blue-600 text-slate-100">
            <div className="mx-auto flex items-center gap-1 sm:gap-2 md:gap-4 p-2 md:p-3">
                <button 
                    onClick={() => navigate('/app')}
                    className="ml-1 sm:ml-2 md:ml-4 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif font-semibold cursor-pointer hover:scale-105 hover:opacity-90 hover:drop-shadow-lg transition-all duration-200 bg-transparent border-none p-0 text-slate-100 whitespace-nowrap flex-shrink-0"
                >
                    Dorm Mart
                </button>
                    <div className="flex-1 mx-1 sm:mx-2 md:mx-3 lg:mx-5 min-w-0">
                      <div className="flex h-12 md:h-15 items-center overflow-hidden rounded-full bg-white shadow-inner">
                        {/* Search icon */}
                        <button
                            type="button"
                            className="flex h-full w-10 sm:w-12 md:w-16 lg:w-20 items-center justify-center border-r border-slate-200 border-black flex-shrink-0"
                        >
                            <img src={searchIcon} alt="" className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
                        </button>
                        
                        <input
                            type="text"
                            placeholder="Search..."
                            className="h-full w-full px-2 sm:px-3 text-sm md:text-base text-slate-900 placeholder-slate-400 focus:outline-none min-w-0"
                        />
                
                        <button
                            type="button"
                            className="flex h-12 w-10 sm:w-12 md:w-16 lg:w-20 items-center justify-center border-l border-slate-200 border-black flex-shrink-0"
                        >
                            <img src={filterIcon} alt="Filter" className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
                        </button>
                      </div>
                    </div>
                <ul className="mr-1 sm:mr-2 flex items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 flex-shrink-0">
                    <Icon to="/app/notification" src={notificationIcon} alt="Notification"/>
                    <Icon to="/app/chat" src={chatIcon} alt="Chat"/> 
                    
                    {/* User icon with dropdown */}
                    <li className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="block"
                        >
                            <img src={userIcon} alt="User Selection" className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10" />
                        </button>
                        
                        {/* Dropdown menu */}
                        {showDropdown && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100 transition-colors"
                                >
                                    Log Out
                                </button>
                            </div>
                        )}
                    </li>
                    
                    <Icon to="/app/setting" src={settingIcon} alt="Setting"/>
                </ul>
            </div>
        </nav>
    )
}


export default MainNav;