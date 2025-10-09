import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import MainNav from '../components/MainNav/MainNav';
import { isAuthenticated } from '../utils/auth';

function RootLayout(){
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is logged in by verifying auth_token cookie
        if (!isAuthenticated()) {
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