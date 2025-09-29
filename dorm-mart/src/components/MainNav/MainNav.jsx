import chatIcon from '../../assets/icons/icons8-chat-96.png'
import userIcon from '../../assets/icons/icons8-user-icon-96.png'
import notificationIcon from '../../assets/icons/icons8-notification-96.png'
import settingIcon from '../../assets/icons/icons8-setting-96.png'
import Icon from './Icon'
import searchIcon from '../../assets/icons/icons8-search-96.png';
import filterIcon from '../../assets/icons/icons8-filter-96.png';

function MainNav() {
    return (
        <nav className="bg-blue-800 text-slate-100">
            <div className="mx-auto flex items-center gap-4 p-3">
                <div className="ml-4 text-4xl font-serif font-semibold">Dorm Mart</div>
                    <div className="flex-1 mx-5">
                      <div className="flex h-15 items-center overflow-hidden rounded-full bg-white shadow-inner">
                        {/* Search icon */}
                        <button
                            type="button"
                            className="flex h-full w-20 items-center justify-center border-r border-slate-200 border-black"
                        >
                            <img src={searchIcon} alt="" className="h-8 w-8" />
                        </button>
                        
                        <input
                            type="text"
                            placeholder="Search..."
                            className="h-full w-full px-3 text-slate-900 placeholder-slate-400 focus:outline-none"
                        />
                
                        <button
                            type="button"
                            className="flex h-12 w-20 items-center justify-center border-l border-slate-200 border-black"
                        >
                            <img src={filterIcon} alt="Filter" className="h-8 w-8" />
                        </button>
                      </div>
                    </div>
                <ul className="mr-2 flex items-center gap-4">
                    <Icon to="/notification" src={notificationIcon} alt="Notification"/>
                    <Icon tp="/chat" src={chatIcon} alt="Chat"/> 
                    <Icon to="/purchase-history" src={userIcon} alt="User Selection"/> 
                    <Icon to="setting" src={settingIcon} alt="Setting"/>
                </ul>
            </div>
        </nav>
    )
}


export default MainNav;