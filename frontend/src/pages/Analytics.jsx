import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    TrendingUp, TrendingDown, Minus, Award, Target, BarChart3,
    ChevronRight, Zap, AlertCircle, CheckCircle, ArrowLeft
} from 'lucide-react';
import { getDetailedAnalytics } from '../services/api';
import Loading from '../components/Loading';

const Analytics = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await getDetailedAnalytics();
                setData(result);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <Loading message="Analyzing your performance..." />;

    if (!data?.has_data) {
        return (
            <div className="min-h-screen px-4 py-8">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <BarChart3 size={48} className="mx-auto text-zinc-600 mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No Analytics Yet</h2>
                    <p className="text-zinc-500 mb-6">{data?.message || 'Complete some interviews to see your analytics!'}</p>
                    <motion.button
                        onClick={() => navigate('/dashboard')}
                        className="btn-primary"
                        whileHover={{ scale: 1.02 }}
                    >
                        Start Practicing
                    </motion.button>
                </div>
            </div>
        );
    }

    const { overview, category_scores, strengths, areas_to_improve, timeline, recommendations } = data;

    const getTrendIcon = () => {
        if (overview.trend === 'improving') return <TrendingUp className="text-green-400" size={20} />;
        if (overview.trend === 'declining') return <TrendingDown className="text-red-400" size={20} />;
        return <Minus className="text-zinc-400" size={20} />;
    };

    return (
        <div className="min-h-screen px-4 sm:px-6 py-6 sm:py-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <motion.div
                    className="flex items-center gap-4 mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">Performance Analytics</h1>
                        <p className="text-sm text-zinc-500">Your interview performance insights</p>
                    </div>
                </motion.div>

                {/* Overview Cards */}
                <motion.div
                    className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <StatCard label="Sessions" value={overview.total_sessions} icon={Target} />
                    <StatCard label="Average" value={`${overview.average_score}%`} icon={Award} highlight={overview.average_score >= 70} />
                    <StatCard label="Best" value={`${overview.best_score}%`} icon={Zap} highlight />
                    <div className="card p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            {getTrendIcon()}
                            <span className="text-xs text-zinc-500 capitalize">{overview.trend}</span>
                        </div>
                        <p className={`text-lg font-bold ${overview.improvement >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {overview.improvement >= 0 ? '+' : ''}{overview.improvement}%
                        </p>
                        <p className="text-xs text-zinc-500">vs previous</p>
                    </div>
                </motion.div>

                {/* Category Scores */}
                <motion.div
                    className="card p-5 mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h3 className="font-semibold mb-4">Category Breakdown</h3>
                    <div className="space-y-4">
                        {category_scores.map((cat, i) => (
                            <div key={cat.name}>
                                <div className="flex justify-between text-sm mb-1.5">
                                    <span>{cat.name}</span>
                                    <span className="font-medium">{cat.score}%</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                                    <motion.div
                                        className={`h-full rounded-full ${cat.score >= 70 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                                cat.score >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                                                    'bg-gradient-to-r from-red-500 to-red-400'
                                            }`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${cat.score}%` }}
                                        transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Strengths & Improvements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <motion.div
                        className="card p-5"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle className="text-green-400" size={18} />
                            <h3 className="font-semibold">Strengths</h3>
                        </div>
                        {strengths.length > 0 ? (
                            <ul className="space-y-2">
                                {strengths.map(s => (
                                    <li key={s} className="text-sm text-zinc-300 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-zinc-500">Keep practicing to identify your strengths!</p>
                        )}
                    </motion.div>

                    <motion.div
                        className="card p-5"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <AlertCircle className="text-amber-400" size={18} />
                            <h3 className="font-semibold">Areas to Improve</h3>
                        </div>
                        {areas_to_improve.length > 0 ? (
                            <ul className="space-y-2">
                                {areas_to_improve.map(a => (
                                    <li key={a} className="text-sm text-zinc-300 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                        {a}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-zinc-500">Great job! No major areas need improvement.</p>
                        )}
                    </motion.div>
                </div>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                    <motion.div
                        className="card p-5 mb-6 bg-gradient-to-r from-blue-900/20 to-transparent border-blue-500/20"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Zap className="text-blue-400" size={18} />
                            Recommendations
                        </h3>
                        <ul className="space-y-2">
                            {recommendations.map((r, i) => (
                                <li key={i} className="text-sm text-zinc-300">{r}</li>
                            ))}
                        </ul>
                    </motion.div>
                )}

                {/* Recent Sessions */}
                <motion.div
                    className="card p-5"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <h3 className="font-semibold mb-4">Recent Sessions</h3>
                    <div className="space-y-2">
                        {timeline.map((session, i) => (
                            <motion.div
                                key={session.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer group"
                                onClick={() => navigate(`/result/${session.id}`)}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6 + i * 0.05 }}
                                whileHover={{ x: 4 }}
                            >
                                <div>
                                    <p className="font-medium text-sm group-hover:text-blue-400 transition-colors">{session.position}</p>
                                    <p className="text-xs text-zinc-500">{session.date} • {session.difficulty}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`font-semibold ${session.score >= 70 ? 'text-green-400' : session.score >= 50 ? 'text-amber-400' : 'text-zinc-400'}`}>
                                        {session.score}%
                                    </span>
                                    <ChevronRight size={16} className="text-zinc-600 group-hover:text-blue-400" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon: Icon, highlight }) => (
    <motion.div className="card p-4 text-center" whileHover={{ y: -2 }}>
        <Icon size={20} className={`mx-auto mb-2 ${highlight ? 'text-green-400' : 'text-zinc-500'}`} />
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
    </motion.div>
);

export default Analytics;
