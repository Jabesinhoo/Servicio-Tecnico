import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (token && userData) {
            try {
                setUser(JSON.parse(userData));
            } catch (error) {
                console.error('Error parsing user data:', error);
                localStorage.clear();
                navigate('/login');
            }
        } else {
            navigate('/login');
        }
        setLoading(false);
    }, [navigate]);

    const logout = () => {
        localStorage.clear();
        setUser(null);
        navigate('/login');
    };

    return { user, loading, logout };
};