import { Link } from 'react-router-dom';
import { Github, Linkedin } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="border-t border-zinc-800/50 mt-20">
            <div className="max-w-5xl mx-auto px-6 py-12">
                <div className="grid md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-2 mb-3">
                            <img src="/logo.png" alt="InterviewIQ" className="w-7 h-7 rounded-md" />
                            <span className="font-semibold">InterviewIQ</span>
                        </div>
                        <p className="text-sm text-zinc-500 leading-relaxed">
                            AI-powered interview coaching to help you land your dream job.
                        </p>
                    </div>

                    {/* Features */}
                    <div>
                        <p className="font-medium text-sm mb-3">Features</p>
                        <ul className="space-y-2 text-sm text-zinc-500">
                            <li><Link to="/dashboard" className="hover:text-white transition-colors">Mock Interview</Link></li>
                            <li><Link to="/ats-scanner" className="hover:text-white transition-colors">ATS Scanner</Link></li>
                            <li><Link to="/quick-practice" className="hover:text-white transition-colors">Quick Practice</Link></li>
                            <li><Link to="/analytics" className="hover:text-white transition-colors">Analytics</Link></li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <p className="font-medium text-sm mb-3">Resources</p>
                        <ul className="space-y-2 text-sm text-zinc-500">
                            <li><Link to="/resources" className="hover:text-white transition-colors">Interview Guides</Link></li>
                            <li><Link to="/interview-guide" className="hover:text-white transition-colors">Fresher Guide</Link></li>
                            <li><Link to="/templates" className="hover:text-white transition-colors">Answer Templates</Link></li>
                            <li><Link to="/company-prep" className="hover:text-white transition-colors">Company Prep</Link></li>
                            <li><Link to="/privacy" className="hover:text-white transition-colors">Your Privacy</Link></li>
                        </ul>
                    </div>

                    {/* Connect */}
                    <div>
                        <p className="font-medium text-sm mb-3">Connect</p>
                        <div className="flex gap-3">
                            <a href="https://github.com/Umesh49" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors"><Github size={18} /></a>
                            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors"><Linkedin size={18} /></a>
                        </div>
                    </div>
                </div>

                {/* Bottom */}
                <div className="mt-12 pt-6 border-t border-zinc-800/50 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-zinc-600">
                    <p>© {new Date().getFullYear()} InterviewIQ. All rights reserved.</p>
                    <p>Built with ❤️ by Umesh & Neha</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
