import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import MainNav from '../components/MainNav/MainNav';

function RootLayout(){
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is logged in
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        
        if (!isLoggedIn) {
            // Redirect to login if not authenticated
            navigate('/login');
        }
    }, [navigate]);

    return (
    <>
        <MainNav />
        <Outlet />
    </>
    )
}


export default RootLayout;