import { Link, useLocation } from 'react-router-dom'
import { Home, Camera, Upload, Database, Hand } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Navbar() {
    const location = useLocation()
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10)
        window.addEventListener('scroll', onScroll)
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const links = [
        { to: '/', label: 'Home', icon: <Home size={16} /> },
        { to: '/capture', label: 'Capture', icon: <Camera size={16} /> },
        { to: '/upload', label: 'Upload', icon: <Upload size={16} /> },
        { to: '/dataset', label: 'Dataset', icon: <Database size={16} /> },
    ]

    return (
        <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
            <Link to="/" className="navbar-brand">
                <div className="brand-icon">
                    <Hand size={20} />
                </div>
                Signaset
            </Link>
            <div className="navbar-links">
                {links.map(link => (
                    <Link
                        key={link.to}
                        to={link.to}
                        className={location.pathname === link.to ? 'active' : ''}
                    >
                        {link.icon}
                        <span>{link.label}</span>
                    </Link>
                ))}
            </div>
        </nav>
    )
}
