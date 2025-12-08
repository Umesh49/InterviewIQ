import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getStudentProgress, uploadResume, createInterview, getResumes, getInterviewHistory } from '../services/api';
import Loading from '../components/Loading';
import {
    TrendingUp, Award, Clock, Upload, Play, Briefcase, FileText,
    CheckCircle, Zap, BookOpen, FileSearch, Video, X, ChevronRight, BarChart3, History, Mic, ArrowRight, Users, Target, Circle
} from 'lucide-react';
import IconSelect from '../components/IconSelect';

const Dashboard = () => {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Interview Setup Modal
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [previousResumes, setPreviousResumes] = useState([]);
    const [useExistingResume, setUseExistingResume] = useState(false);
    const [resumeFile, setResumeFile] = useState(null);
    const [resumeId, setResumeId] = useState(null);
    const [position, setPosition] = useState('');
    const [difficulty, setDifficulty] = useState('Medium');
    const [experienceLevel, setExperienceLevel] = useState('0-2 years');
    const [isUploading, setIsUploading] = useState(false);
    const [isStarting, setIsStarting] = useState(false);

    // History
    const [interviewHistory, setInterviewHistory] = useState([]);

    useEffect(() => {
        const init = async () => {
            try {
                const [progress, resumes, history] = await Promise.all([
                    getStudentProgress().catch(() => []),
                    getResumes().catch(() => []),
                    getInterviewHistory().catch(() => [])
                ]);

                setData(progress || []);
                setPreviousResumes(resumes || []);
                if (resumes?.length > 0) {
                    setUseExistingResume(true);
                    setResumeId(resumes[0].id);
                }
                // Filter out incomplete sessions (no overall_score means no responses submitted)
                const completedHistory = (history || [])
                    .filter(h => h.overall_score !== null && h.overall_score !== undefined)
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                setInterviewHistory(completedHistory);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleResumeUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setResumeFile(file);
        setIsUploading(true);
        try {
            const result = await uploadResume(file);
            setResumeId(result.id);
        } catch (err) {
            alert('Failed to upload resume');
        } finally {
            setIsUploading(false);
        }
    };

    const handleStartInterview = async () => {
        if (!resumeId || !position.trim()) return;
        setIsStarting(true);
        try {
            const session = await createInterview(resumeId, position.trim(), difficulty, experienceLevel);
            navigate(`/interview/${session.id}`);
        } catch (err) {
            alert('Failed to create interview');
        } finally {
            setIsStarting(false);
        }
    };

    if (loading) {
        return <Loading message="Loading your dashboard..." />;
    }

    const avgScore = data.length > 0 ? Math.round(data.reduce((a, b) => a + b.overall, 0) / data.length) : 0;

    return (
        <div className="min-h-screen px-4 sm:px-6 py-6 sm:py-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-2xl sm:text-3xl font-bold mb-1">Welcome back 👋</h1>
                    <p className="text-sm sm:text-base text-zinc-400">Ready to practice?</p>
                </motion.div>

                {/* Main Action Card */}
                <motion.div
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 sm:p-8 mb-6 cursor-pointer group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setShowSetupModal(true)}
                >
                    {/* Background pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
                    </div>

                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                    <Video size={24} className="text-white" />
                                </div>
                                <h2 className="text-xl sm:text-2xl font-semibold text-white">Start Mock Interview</h2>
                            </div>
                            <p className="text-blue-100 text-sm sm:text-base max-w-md">
                                Practice with AI and get real-time feedback on your speech, body language, and answers.
                            </p>
                        </div>
                        <motion.div
                            className="w-14 h-14 rounded-full bg-white flex items-center justify-center shrink-0 self-end sm:self-center"
                            whileHover={{ scale: 1.1 }}
                        >
                            <Play size={24} className="text-blue-600 ml-1" fill="currentColor" />
                        </motion.div>
                    </div>
                </motion.div>

                {/* Stats Row */}
                <motion.div
                    className="grid grid-cols-3 gap-3 sm:gap-4 mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <StatCard icon={TrendingUp} label="Sessions" value={data.length} />
                    <StatCard icon={Award} label="Avg Score" value={`${avgScore}%`} highlight={avgScore >= 70} />
                    <StatCard icon={Clock} label="Practice" value={`${data.length * 15}m`} />
                </motion.div>

                {/* Feature Grid - Row 1 */}
                <motion.div
                    className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                >
                    <FeatureCard
                        icon={FileSearch}
                        title="ATS Scanner"
                        desc="Check resume compatibility"
                        color="purple"
                        onClick={() => navigate('/ats-scanner')}
                    />
                    <FeatureCard
                        icon={BookOpen}
                        title="Resources"
                        desc="Tips & guides for freshers"
                        color="green"
                        onClick={() => navigate('/resources')}
                    />
                    <FeatureCard
                        icon={BarChart3}
                        title="Analytics"
                        desc="View your performance"
                        color="amber"
                        onClick={() => navigate('/analytics')}
                    />
                </motion.div>

                {/* Feature Grid - Row 2 */}
                <motion.div
                    className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.35 }}
                >
                    <FeatureCard
                        icon={Briefcase}
                        title="Company Prep"
                        desc="TCS, Infosys, Wipro & more"
                        color="blue"
                        onClick={() => navigate('/company-prep')}
                    />
                    <FeatureCard
                        icon={FileText}
                        title="Answer Templates"
                        desc="Ready-to-use answers"
                        color="pink"
                        onClick={() => navigate('/templates')}
                    />
                    <FeatureCard
                        icon={Zap}
                        title="Quick Practice"
                        desc="5-minute drill"
                        color="cyan"
                        onClick={() => navigate('/quick-practice')}
                    />
                </motion.div>

                {/* Progress + History Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* Progress Card */}
                    <motion.div
                        className="card p-5"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-semibold">This Week</h3>
                            <TrendingUp size={18} className="text-green-400" />
                        </div>
                        <div className="space-y-4">
                            <ProgressBar label="Sessions" value={Math.min(data.length, 5)} max={5} color="blue" />
                            <ProgressBar label="Improvement" value={Math.min(avgScore, 100)} max={100} color="green" suffix="%" />
                        </div>
                    </motion.div>

                    {/* Recent History */}
                    <motion.div
                        className="lg:col-span-2 card p-5"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <History size={18} className="text-purple-400" />
                                <h3 className="font-semibold">Recent Sessions</h3>
                            </div>
                            {interviewHistory.length > 3 && (
                                <button className="text-xs text-zinc-500 hover:text-blue-400 transition-colors flex items-center gap-1">
                                    View all <ChevronRight size={14} />
                                </button>
                            )}
                        </div>

                        {interviewHistory.length > 0 ? (
                            <div className="space-y-2">
                                {interviewHistory.slice(0, 4).map((session, index) => (
                                    <motion.div
                                        key={session.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer group"
                                        onClick={() => navigate(`/result/${session.id}`)}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.6 + index * 0.05 }}
                                        whileHover={{ x: 4 }}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${(session.overall_score || 0) >= 70 ? 'bg-green-500/20 text-green-400' :
                                                (session.overall_score || 0) >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-500/20 text-zinc-400'
                                                }`}>
                                                <Mic size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate group-hover:text-blue-400 transition-colors">
                                                    {session.position || 'Interview'}
                                                </p>
                                                <p className="text-xs text-zinc-500">
                                                    {new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-semibold ${(session.overall_score || 0) >= 70 ? 'text-green-400' :
                                                (session.overall_score || 0) >= 50 ? 'text-amber-400' : 'text-zinc-400'
                                                }`}>
                                                {Math.round(session.overall_score || 0)}%
                                            </span>
                                            <ArrowRight size={14} className="text-zinc-600 group-hover:text-blue-400 transition-colors" />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-zinc-500">
                                <History size={28} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No interviews yet</p>
                                <p className="text-xs">Start your first session!</p>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>

            {/* Interview Setup Modal */}
            <AnimatePresence>
                {showSetupModal && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSetupModal(false)}
                    >
                        <motion.div
                            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl"
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold">Start Interview</h2>
                                <motion.button
                                    onClick={() => setShowSetupModal(false)}
                                    className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <X size={18} className="text-zinc-500" />
                                </motion.button>
                            </div>

                            <div className="space-y-4">
                                {/* Resume */}
                                <div>
                                    <label className="text-sm text-zinc-400 mb-2 flex justify-between">
                                        <span>Resume</span>
                                        {previousResumes.length > 0 && (
                                            <button
                                                onClick={() => setUseExistingResume(!useExistingResume)}
                                                className="text-xs text-blue-400 hover:text-blue-300"
                                            >
                                                {useExistingResume ? 'Upload new' : 'Use existing'}
                                            </button>
                                        )}
                                    </label>
                                    {useExistingResume && previousResumes.length > 0 ? (
                                        <IconSelect
                                            value={resumeId || ''}
                                            onChange={setResumeId}
                                            placeholder="Select a resume"
                                            options={previousResumes.map(r => ({
                                                value: r.id,
                                                label: r.file.split('/').pop().substring(0, 25) + '...',
                                                icon: FileText
                                            }))}
                                        />
                                    ) : (
                                        <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all">
                                            <Upload size={18} className="text-zinc-500" />
                                            <span className="text-sm text-zinc-400">
                                                {resumeFile ? resumeFile.name : 'Choose PDF'}
                                            </span>
                                            <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} disabled={isUploading} />
                                        </label>
                                    )}
                                    {isUploading && <p className="text-xs text-amber-400 mt-2">Uploading...</p>}
                                    {!isUploading && resumeId && !useExistingResume && (
                                        <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                                            <CheckCircle size={12} /> Ready
                                        </p>
                                    )}
                                </div>

                                {/* Position */}
                                <div>
                                    <label className="text-sm text-zinc-400 mb-2 block">Position</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                                        <input
                                            type="text"
                                            value={position}
                                            onChange={(e) => setPosition(e.target.value)}
                                            placeholder="e.g., Software Engineer"
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                {/* Experience & Difficulty */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm text-zinc-400 mb-2 block">Experience</label>
                                        <IconSelect
                                            value={experienceLevel}
                                            onChange={setExperienceLevel}
                                            options={[
                                                { value: '0-2 years', label: '0-2 years', icon: Users },
                                                { value: '3-5 years', label: '3-5 years', icon: Users },
                                                { value: '5-10 years', label: '5-10 years', icon: Users },
                                                { value: '10+ years', label: '10+ years', icon: Users },
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-zinc-400 mb-2 block">Difficulty</label>
                                        <IconSelect
                                            value={difficulty}
                                            onChange={setDifficulty}
                                            options={[
                                                { value: 'Easy', label: 'Easy', icon: Circle },
                                                { value: 'Medium', label: 'Medium', icon: Target },
                                                { value: 'Hard', label: 'Hard', icon: Zap },
                                            ]}
                                        />
                                    </div>
                                </div>

                                {/* Start Button */}
                                <motion.button
                                    onClick={handleStartInterview}
                                    disabled={!resumeId || isStarting || !position.trim()}
                                    className="btn-primary w-full py-3.5 mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                    whileHover={{ scale: !resumeId || !position.trim() ? 1 : 1.02 }}
                                    whileTap={{ scale: !resumeId || !position.trim() ? 1 : 0.98 }}
                                >
                                    <Zap size={18} />
                                    {isStarting ? 'Starting...' : 'Begin Interview'}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Stat Card
const StatCard = ({ icon: Icon, label, value, highlight }) => (
    <motion.div
        className="card p-4 text-center"
        whileHover={{ y: -2 }}
    >
        <Icon size={20} className={`mx-auto mb-2 ${highlight ? 'text-green-400' : 'text-zinc-500'}`} />
        <p className="text-xl sm:text-2xl font-bold">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
    </motion.div>
);

// Feature Card - Square vertical layout
const FeatureCard = ({ icon: Icon, title, desc, color, onClick }) => {
    const iconBg = {
        purple: 'bg-purple-500/20',
        green: 'bg-green-500/20',
        amber: 'bg-amber-500/20',
        blue: 'bg-blue-500/20',
        pink: 'bg-pink-500/20',
        cyan: 'bg-cyan-500/20'
    };
    const iconColor = {
        purple: 'text-purple-400',
        green: 'text-green-400',
        amber: 'text-amber-400',
        blue: 'text-blue-400',
        pink: 'text-pink-400',
        cyan: 'text-cyan-400'
    };
    const borderHover = {
        purple: 'hover:border-purple-500/30',
        green: 'hover:border-green-500/30',
        amber: 'hover:border-amber-500/30',
        blue: 'hover:border-blue-500/30',
        pink: 'hover:border-pink-500/30',
        cyan: 'hover:border-cyan-500/30'
    };

    return (
        <motion.div
            className={`card p-4 sm:p-5 text-center group cursor-pointer ${borderHover[color] || ''}`}
            whileHover={{ y: -3, scale: 1.02 }}
            onClick={onClick}
        >
            <div className={`w-12 h-12 rounded-xl ${iconBg[color] || 'bg-zinc-500/20'} flex items-center justify-center mx-auto mb-3`}>
                <Icon size={22} className={iconColor[color] || 'text-zinc-400'} />
            </div>
            <p className="font-semibold text-sm mb-1">{title}</p>
            <p className="text-xs text-zinc-500">{desc}</p>
        </motion.div>
    );
};

// Progress Bar
const ProgressBar = ({ label, value, max, color, suffix = '' }) => {
    const colors = {
        blue: 'from-blue-500 to-blue-400',
        green: 'from-green-500 to-green-400'
    };
    const percent = Math.min((value / max) * 100, 100);

    return (
        <div>
            <div className="flex justify-between text-sm mb-1.5">
                <span className="text-zinc-400">{label}</span>
                <span className="font-medium">{value}{suffix}{max !== 100 ? `/${max}` : ''}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${colors[color]}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
};

export default Dashboard;
