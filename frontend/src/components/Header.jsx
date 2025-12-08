import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, Menu, X, ChevronDown } from 'lucide-react';

const Header = () => {
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [featuresOpen, setFeaturesOpen] = useState(false);
    const dropdownRef = useRef(null);

    if (location.pathname.includes('/interview-session/')) return null;

    useEffect(() => {
        setFeaturesOpen(false);
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setFeaturesOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const navLinks = [
        { path: '/', label: 'Home' },
        { path: '/dashboard', label: 'Dashboard' },
    ];

    const featureLinks = [
        { path: '/interview-guide', label: 'Fresher Guide' },
        { path: '/resources', label: 'Resources' },
        { path: '/templates', label: 'Answer Templates' },
        { path: '/company-prep', label: 'Company Prep' },
        { path: '/quick-practice', label: 'Quick Practice' },
        { path: '/ats-scanner', label: 'ATS Scanner' },
        { path: '/analytics', label: 'Analytics' },
        { path: '/privacy', label: 'Privacy' },
    ];

    return (
        <header className="fixed top-0 left-0 right-0 z-50">
            <div className="mx-4 mt-4">
                <nav className="max-w-5xl mx-auto px-6 py-3 glass-card flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2.5">
                        <img src="/logo.png" alt="InterviewIQ" className="w-9 h-9 rounded-lg shadow-lg" />
                        <span className="font-semibold text-white">InterviewIQ</span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map(({ path, label }) => (
                            <Link
                                key={path}
                                to={path}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive(path)
                                    ? 'text-white bg-white/10'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {label}
                            </Link>
                        ))}

                        {/* Features Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setFeaturesOpen(!featuresOpen)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${featuresOpen
                                    ? 'text-white bg-white/10'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                Features
                                <ChevronDown size={16} className={`transition-transform duration-200 ${featuresOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            {featuresOpen && (
                                <div className="absolute top-full left-0 mt-2 w-48 py-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl animate-fade-in">
                                    {featureLinks.map(({ path, label }) => (
                                        <Link
                                            key={path}
                                            to={path}
                                            onClick={() => setFeaturesOpen(false)}
                                            className={`block px-4 py-2 text-sm transition-colors ${isActive(path)
                                                ? 'text-white bg-white/10'
                                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            {label}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="hidden md:block">
                        <Link to="/dashboard" className="btn-primary text-sm py-2 px-5">Start Practice</Link>
                    </div>

                    {/* Mobile Toggle */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden p-2 text-zinc-400 hover:text-white"
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </nav>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden mt-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-fade-in max-h-[80vh] overflow-y-auto">
                        {navLinks.map(({ path, label }) => (
                            <Link
                                key={path}
                                to={path}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`block px-4 py-3 rounded-lg mb-1 ${isActive(path) ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
                            >
                                {label}
                            </Link>
                        ))}
                        <div className="mt-3 pt-3 border-t border-zinc-800">
                            <p className="px-4 py-2 text-xs text-zinc-500 uppercase tracking-wider">Features</p>
                            {featureLinks.map(({ path, label }) => (
                                <Link
                                    key={path}
                                    to={path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`block px-4 py-2.5 rounded-lg text-sm ${isActive(path) ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5'}`}
                                >
                                    {label}
                                </Link>
                            ))}
                        </div>
                        <div className="mt-4 pt-3 border-t border-zinc-800">
                            <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="btn-primary w-full text-center">
                                Start Practice
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;
