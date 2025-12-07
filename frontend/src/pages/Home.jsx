import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, Mic, Video, BarChart } from 'lucide-react';

const Home = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>

            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
                Master Your Interview
            </h1>
            <p className="text-xl text-gray-300 mb-12 max-w-2xl">
                AI-powered mock interviews with real-time body language analysis, speech tracking, and personalized feedback.
            </p>

            <Link to="/dashboard" className="btn-primary text-lg px-8 py-4 flex items-center gap-3">
                Start Practice <Bot size={24} />
            </Link>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
                <FeatureCard icon={<Video />} title="Body Language" desc="Real-time posture and eye contact tracking." />
                <FeatureCard icon={<Mic />} title="Speech Analysis" desc="Fluency, pace, and filler word detection." />
                <FeatureCard icon={<BarChart />} title="Deep Insights" desc="Comprehensive report with actionable tips." />
            </div>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc }) => (
    <div className="glass-panel p-6 flex flex-col items-center hover:scale-105 transition-transform">
        <div className="text-primary-400 mb-4">{React.cloneElement(icon, { size: 40 })}</div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-400 text-sm">{desc}</p>
    </div>
);

export default Home;
