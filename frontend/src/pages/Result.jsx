import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { CheckCircle, AlertTriangle, Mic, Trash2, Home, Brain, MessageSquare, Target, Award, ChevronLeft, ChevronRight, Zap, Volume2, Clock, Hash, ExternalLink, Play, BookOpen } from 'lucide-react';
import { getInterviewResult } from '../services/api';
import Loading from '../components/Loading';

// Animation variants
const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const Result = () => {
    const { sessionId } = useParams();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestion, setCurrentQuestion] = useState(0);

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const data = await getInterviewResult(sessionId);
                setResult(data);
            } catch (error) {
                console.error("Error fetching result:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchResult();
    }, [sessionId]);

    if (loading) {
        return <Loading />;
    }

    if (!result) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <AlertTriangle size={48} className="text-red-400" />
                <p className="text-gray-400">Failed to load result.</p>
                <Link to="/dashboard" className="btn-primary">Back to Dashboard</Link>
            </div>
        );
    }

    const handleDelete = async () => {
        if (window.confirm("Delete this interview session?")) {
            try {
                const { deleteSession } = await import('../services/api');
                await deleteSession(sessionId);
                window.location.href = '/dashboard';
            } catch (e) {
                alert("Failed to delete.");
            }
        }
    };

    const overallScore = Math.round(result.overall_score || 0);
    const responses = result.responses || [];
    const currentResp = responses[currentQuestion];

    return (
        <div className="min-h-screen px-6 py-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-1">Interview Results</h1>
                    <p className="text-gray-500 text-sm">{result.position || 'Interview Session'}</p>
                </div>
                <div className="flex gap-2">
                    <Link to="/dashboard" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm flex items-center gap-2 transition-colors">
                        <Home size={16} /> Dashboard
                    </Link>
                    <button onClick={handleDelete} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2 transition-colors">
                        <Trash2 size={16} /> Delete
                    </button>
                </div>
            </div>

            {/* Score Overview - Compact */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Overall Score */}
                <motion.div
                    initial="hidden" animate="visible" variants={fadeIn}
                    className="bg-white/[0.03] border border-white/10 rounded-xl p-6 flex items-center gap-6"
                >
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold ${overallScore >= 70 ? 'bg-green-500/20 text-green-400' :
                        overallScore >= 50 ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                        }`}>
                        {overallScore}%
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Overall Score</p>
                        <p className="text-lg font-semibold">
                            {overallScore >= 70 ? 'Great job!' : overallScore >= 50 ? 'Good effort' : 'Keep practicing'}
                        </p>
                    </div>
                </motion.div>

                {/* Radar Chart */}
                <motion.div
                    initial="hidden" animate="visible" variants={fadeIn}
                    className="lg:col-span-2 bg-white/[0.03] border border-white/10 rounded-xl p-4"
                >
                    <ResponsiveContainer width="100%" height={180}>
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={result.category_scores || []}>
                            <PolarGrid stroke="rgba(255,255,255,0.1)" />
                            <PolarAngleAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                            <Radar dataKey="score" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                        </RadarChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>

            {/* Question Navigation */}
            {responses.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Mic className="text-primary-400" size={20} />
                            Question Analysis
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                                disabled={currentQuestion === 0}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-sm text-gray-400 min-w-[80px] text-center">
                                {currentQuestion + 1} of {responses.length}
                            </span>
                            <button
                                onClick={() => setCurrentQuestion(Math.min(responses.length - 1, currentQuestion + 1))}
                                disabled={currentQuestion === responses.length - 1}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Quick Jump Pills */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {responses.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentQuestion(idx)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${idx === currentQuestion
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                Q{idx + 1}
                            </button>
                        ))}
                    </div>

                    {/* Current Question Card */}
                    {currentResp && (
                        <motion.div
                            key={currentQuestion}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden"
                        >
                            {/* Question Header */}
                            <div className="p-5 border-b border-white/10 bg-white/[0.02]">
                                <p className="text-white font-medium">{currentResp.question_text || 'Question'}</p>
                            </div>

                            {/* Metrics Row */}
                            <div className="grid grid-cols-4 divide-x divide-white/10 border-b border-white/10">
                                <MetricItem
                                    icon={Zap}
                                    label="Pace"
                                    value={`${currentResp.body_language_metadata?.voice_metrics?.words_per_minute || 0} wpm`}
                                    status={getWpmStatus(currentResp.body_language_metadata?.voice_metrics?.words_per_minute)}
                                />
                                <MetricItem
                                    icon={Clock}
                                    label="Pauses"
                                    value={currentResp.body_language_metadata?.voice_metrics?.pause_count || 0}
                                />
                                <MetricItem
                                    icon={Hash}
                                    label="Words"
                                    value={currentResp.body_language_metadata?.voice_metrics?.word_count || 0}
                                />
                                <MetricItem
                                    icon={Volume2}
                                    label="Volume"
                                    value={getVolumeLabel(currentResp.body_language_metadata?.voice_metrics?.average_volume)}
                                    status={getVolumeStatus(currentResp.body_language_metadata?.voice_metrics?.average_volume)}
                                />
                            </div>

                            {/* Body Language Row - Photo Analysis */}
                            {currentResp.body_language_metadata?.photo_analysis && (
                                <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10 bg-white/[0.01]">
                                    <MetricItem
                                        icon={CheckCircle}
                                        label="Posture"
                                        value={`${Math.round(currentResp.body_language_metadata.photo_analysis.posture_score || 70)}%`}
                                        status={getBodyLanguageStatus(currentResp.body_language_metadata.photo_analysis.posture_score)}
                                    />
                                    <MetricItem
                                        icon={Target}
                                        label="Eye Contact"
                                        value={`${Math.round(currentResp.body_language_metadata.photo_analysis.eye_contact_score || 70)}%`}
                                        status={getBodyLanguageStatus(currentResp.body_language_metadata.photo_analysis.eye_contact_score)}
                                    />
                                    <MetricItem
                                        icon={Award}
                                        label="Confidence"
                                        value={`${Math.round(currentResp.body_language_metadata.photo_analysis.confidence_score || 70)}%`}
                                        status={getBodyLanguageStatus(currentResp.body_language_metadata.photo_analysis.confidence_score)}
                                    />
                                </div>
                            )}

                            {/* AI Feedback - Properly Formatted */}
                            <div className="p-5">
                                <AIFeedbackDisplay response={currentResp} />
                            </div>

                            {/* Transcript */}
                            <div className="px-5 pb-5">
                                <div className="bg-zinc-900/50 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                        <MessageSquare size={12} /> Your Answer
                                    </p>
                                    <p className="text-gray-300 text-sm italic">
                                        "{currentResp.transcript || 'No transcript'}"
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Strengths */}
                {result.strengths?.length > 0 && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-5">
                        <h3 className="font-semibold mb-4 flex items-center gap-2 text-green-400">
                            <Award size={18} /> Strengths
                        </h3>
                        <ul className="space-y-2">
                            {result.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                    <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Areas to Improve */}
                {result.areas_for_improvement?.length > 0 && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
                        <h3 className="font-semibold mb-4 flex items-center gap-2 text-amber-400">
                            <Target size={18} /> Areas to Improve
                        </h3>
                        <ul className="space-y-2">
                            {result.areas_for_improvement.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Learning Path */}
            {result.learning_path?.length > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <BookOpen size={18} className="text-accent-400" /> Recommended Learning
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {result.learning_path.map((item, i) => (
                            <a
                                key={i}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-4 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer group"
                            >
                                <div className="flex justify-between items-start">
                                    <p className="font-medium text-sm text-white group-hover:text-blue-400 transition-colors">{item.title}</p>
                                    <ExternalLink size={14} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{item.type} • {item.duration}</p>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper components
const MetricItem = ({ icon: Icon, label, value, status }) => (
    <div className="p-4 text-center">
        <Icon size={16} className="mx-auto mb-1 text-gray-500" />
        <p className={`text-lg font-semibold ${status === 'good' ? 'text-green-400' :
            status === 'warning' ? 'text-amber-400' :
                status === 'bad' ? 'text-red-400' : 'text-white'
            }`}>{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
    </div>
);

const AIFeedbackDisplay = ({ response }) => {
    const {
        strengths: newStrengths,
        weaknesses: newWeaknesses,
        detailed_positives,
        detailed_improvements,
        feedback_text,
        correctness_feedback,
        is_answer_correct,
        improvement_tips,
        grammar_errors
    } = response;

    // Parse structured feedback
    let strengths = newStrengths || detailed_positives || [];
    let areas = newWeaknesses || detailed_improvements || [];
    const feedbackText = feedback_text || '';

    if (feedbackText && feedbackText.includes('Strengths:')) {
        const parts = feedbackText.split('**Areas to improve:**');
        if (parts[0]) {
            const strengthsPart = parts[0].replace('**Strengths:**', '').trim();
            strengths = strengthsPart.split(';').map(s => s.trim()).filter(s => s);
        }
        if (parts[1]) {
            areas = parts[1].split(';').map(s => s.trim()).filter(s => s);
        }
    }

    // Fallback to generated feedback from voice metrics
    const vm = response.body_language_metadata?.voice_metrics || {};
    if (strengths.length === 0) {
        if (vm.words_per_minute >= 100 && vm.words_per_minute <= 150) strengths.push('Good speaking pace');
        if ((vm.filler_words || {}) && Object.keys(vm.filler_words).length === 0) strengths.push('No filler words detected');
        if (vm.pause_count <= 2) strengths.push('Smooth delivery with minimal pauses');
    }
    if (areas.length === 0) {
        if (vm.words_per_minute < 80) areas.push(`Slow pace (${vm.words_per_minute} wpm) - aim for 120-140 wpm`);
        if (vm.words_per_minute > 160) areas.push(`Fast pace (${vm.words_per_minute} wpm) - slow down for clarity`);
        if (vm.word_count < 20) areas.push(`Brief response (${vm.word_count} words) - add more detail`);
        if (vm.average_volume < 0.3) areas.push('Quiet voice - project more confidently');
    }

    if (strengths.length === 0 && areas.length === 0 && !feedbackText) {
        return <p className="text-gray-500 text-sm">No AI feedback available</p>;
    }

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2 text-primary-400">
                <Brain size={16} /> AI Analysis
            </h4>

            {/* technical correctness */}
            {correctness_feedback && (
                <div className={`border rounded-lg p-4 ${is_answer_correct === false
                    ? 'bg-red-500/5 border-red-500/10'
                    : 'bg-blue-500/5 border-blue-500/10'}`}>
                    <h4 className={`text-sm font-medium flex items-center gap-2 mb-2 ${is_answer_correct === false ? 'text-red-400' : 'text-blue-400'}`}>
                        {is_answer_correct === false ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                        Technical Feedback
                    </h4>
                    <p className="text-sm text-gray-300">{correctness_feedback}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                {strengths.length > 0 && (
                    <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-4">
                        <p className="text-xs font-medium text-green-400 mb-2 uppercase tracking-wide">What You Did Well</p>
                        <ul className="space-y-1.5">
                            {strengths.map((s, i) => (
                                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                    <CheckCircle size={12} className="text-green-400 mt-1 shrink-0" />
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Areas to Improve */}
                {areas.length > 0 && (
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-4">
                        <p className="text-xs font-medium text-amber-400 mb-2 uppercase tracking-wide">To Improve</p>
                        <ul className="space-y-1.5">
                            {areas.map((s, i) => (
                                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                    <AlertTriangle size={12} className="text-amber-400 mt-1 shrink-0" />
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Improvement Tips */}
            {improvement_tips && improvement_tips.length > 0 && (
                <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-4">
                    <p className="text-xs font-medium text-purple-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                        <Zap size={12} /> Pro Tips
                    </p>
                    <ul className="space-y-1.5">
                        {improvement_tips.map((tip, i) => (
                            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                                {tip}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Grammar Issues */}
            {grammar_errors && grammar_errors.length > 0 && (
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
                    <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Grammar Notes</p>
                    <ul className="space-y-1.5">
                        {grammar_errors.map((err, i) => (
                            <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                                <span className="text-zinc-500">•</span>
                                {err}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Recommended Resources */}
            {response.recommended_resources && response.recommended_resources.length > 0 && (
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4 mt-4">
                    <p className="text-xs font-medium text-blue-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                        <Play size={12} /> Recommended Learning
                    </p>
                    <div className="space-y-2">
                        {response.recommended_resources.map((res, i) => (
                            <a
                                key={i}
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-all group border border-white/5 hover:border-blue-500/30"
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-gray-200 font-medium group-hover:text-blue-300 transition-colors">
                                        {res.title}
                                    </p>
                                    <ExternalLink size={14} className="text-gray-600 group-hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100" />
                                </div>
                                {res.topic && (
                                    <p className="text-xs text-gray-500 mt-1 group-hover:text-gray-400">
                                        Focus: {res.topic}
                                    </p>
                                )}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Utility functions
const getWpmStatus = (wpm) => {
    if (!wpm) return 'neutral';
    if (wpm >= 100 && wpm <= 150) return 'good';
    if (wpm < 80 || wpm > 170) return 'bad';
    return 'warning';
};

const getVolumeStatus = (vol) => {
    if (!vol) return 'neutral';
    if (vol >= 0.4 && vol <= 0.8) return 'good';
    if (vol < 0.3) return 'bad';
    return 'warning';
};

const getVolumeLabel = (vol) => {
    if (!vol) return 'N/A';
    if (vol >= 0.6) return 'Strong';
    if (vol >= 0.4) return 'Good';
    if (vol >= 0.3) return 'Soft';
    return 'Quiet';
};

const getBodyLanguageStatus = (score) => {
    if (!score) return 'neutral';
    if (score >= 80) return 'good';
    if (score >= 60) return 'warning';
    return 'bad';
};

export default Result;

