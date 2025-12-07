import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { CheckCircle, AlertTriangle, BookOpen, Activity, Mic, FileText, Play, Video } from 'lucide-react';
import { getInterviewResult } from '../services/api';

// Helper component for Question Review with Voice Metrics
const QuestionReview = ({ response, index }) => {
    // Extract voice metrics from body_language_metadata
    const voiceMetrics = response.body_language_metadata?.voice_metrics || {};
    const wpm = voiceMetrics.words_per_minute || 0;
    const pauseCount = voiceMetrics.pause_count || 0;
    const longestPause = voiceMetrics.longest_pause_seconds || 0;
    const avgVolume = voiceMetrics.average_volume || 0;
    const fillerWords = voiceMetrics.filler_words || {};
    const wordCount = voiceMetrics.word_count || 0;
    const speakingDuration = voiceMetrics.speaking_duration_seconds || 0;
    const totalFillers = Object.values(fillerWords).reduce((a, b) => a + b, 0);

    // Calculate performance indicators
    const wpmStatus = wpm < 80 ? 'slow' : wpm > 160 ? 'fast' : 'good';
    const volumeStatus = avgVolume < 0.3 ? 'quiet' : avgVolume > 0.8 ? 'loud' : 'good';
    const fillerStatus = totalFillers > 5 ? 'high' : totalFillers > 2 ? 'moderate' : 'low';
    const pauseStatus = pauseCount > 3 ? 'many' : 'acceptable';

    // Use AI-generated detailed feedback if available, else fallback to calculated
    const aiPositives = response.detailed_positives || [];
    const aiImprovements = response.detailed_improvements || [];

    // Fallback: Generate positives based on metrics (if AI didn't provide)
    const fallbackPositives = [];
    if (wpmStatus === 'good') fallbackPositives.push(`Your speaking pace of ${wpm} words/minute was excellent - conversational and easy to follow.`);
    if (volumeStatus === 'good') fallbackPositives.push('Clear and audible voice - you projected well.');
    if (fillerStatus === 'low') fallbackPositives.push('Minimal filler words - your delivery was polished and confident.');
    if (pauseStatus === 'acceptable') fallbackPositives.push('Smooth flow without excessive pauses.');
    if (wordCount > 50) fallbackPositives.push(`Detailed answer with ${wordCount} words - good depth and thoroughness!`);

    // Fallback: Generate areas for improvement (if AI didn't provide)
    const fallbackImprovements = [];
    if (wpmStatus === 'fast') fallbackImprovements.push(`At ${wpm} words/minute, you spoke quickly. Try slowing down for clarity.`);
    if (wpmStatus === 'slow') fallbackImprovements.push(`Your pace of ${wpm} words/minute was a bit slow. Speaking more naturally can convey confidence.`);
    if (volumeStatus === 'quiet') fallbackImprovements.push('You spoke quietly. Project your voice more to sound confident.');
    if (fillerStatus === 'high') fallbackImprovements.push(`You used ${totalFillers} filler words (${Object.keys(fillerWords).join(', ')}). Practice pausing instead.`);
    if (pauseStatus === 'many') fallbackImprovements.push(`You had ${pauseCount} noticeable pauses. This might indicate nervousness.`);
    if (wordCount < 20) fallbackImprovements.push(`Your answer was brief (${wordCount} words). Try elaborating with specific examples.`);

    // Prefer AI feedback, fallback to calculated
    const positives = aiPositives.length > 0 ? aiPositives : fallbackPositives;
    const improvements = aiImprovements.length > 0 ? aiImprovements : fallbackImprovements;



    const getStatusColor = (status) => {
        if (status === 'good' || status === 'low' || status === 'acceptable') return 'text-green-400';
        if (status === 'moderate' || status === 'slow' || status === 'fast') return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="glass-panel p-6 mb-8">
            <h4 className="text-xl font-bold mb-6 flex items-center gap-2 pb-4 border-b border-white/10">
                <span className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm">{index + 1}</span>
                {response.question_text || "Question"}
            </h4>

            {/* Voice Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-dark-800 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400 mb-1">Speaking Pace</p>
                    <p className={`text-2xl font-bold ${getStatusColor(wpmStatus)}`}>{wpm}</p>
                    <p className="text-xs text-gray-500">words/min</p>
                </div>
                <div className="bg-dark-800 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400 mb-1">Pauses</p>
                    <p className={`text-2xl font-bold ${getStatusColor(pauseStatus)}`}>{pauseCount}</p>
                    <p className="text-xs text-gray-500">{longestPause > 0 ? `longest: ${longestPause}s` : 'none detected'}</p>
                </div>
                <div className="bg-dark-800 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400 mb-1">Filler Words</p>
                    <p className={`text-2xl font-bold ${getStatusColor(fillerStatus)}`}>{totalFillers}</p>
                    <p className="text-xs text-gray-500">{Object.keys(fillerWords).slice(0, 2).join(', ') || 'none'}</p>
                </div>
                <div className="bg-dark-800 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400 mb-1">Volume</p>
                    <div className="flex items-center justify-center gap-1 my-1">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div
                                key={i}
                                className={`w-2 h-4 rounded ${avgVolume * 5 >= i ? 'bg-green-500' : 'bg-gray-700'}`}
                            />
                        ))}
                    </div>
                    <p className={`text-xs ${getStatusColor(volumeStatus)}`}>{volumeStatus}</p>
                </div>
            </div>

            {/* Positives & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {positives.length > 0 && (
                    <div className="bg-green-900/20 border border-green-700/30 p-4 rounded-lg">
                        <h5 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
                            <CheckCircle size={16} /> What you did well
                        </h5>
                        <ul className="text-sm space-y-1">
                            {positives.map((p, i) => <li key={i} className="text-green-200">• {p}</li>)}
                        </ul>
                    </div>
                )}
                {improvements.length > 0 && (
                    <div className="bg-yellow-900/20 border border-yellow-700/30 p-4 rounded-lg">
                        <h5 className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">
                            <AlertTriangle size={16} /> Areas to improve
                        </h5>
                        <ul className="text-sm space-y-1">
                            {improvements.map((p, i) => <li key={i} className="text-yellow-200">• {p}</li>)}
                        </ul>
                    </div>
                )}
            </div>

            {/* Transcript */}
            <div className="bg-dark-800 p-4 rounded-lg mb-4">
                <h5 className="text-sm text-gray-400 mb-2">Your Answer ({wordCount} words, {speakingDuration}s)</h5>
                <p className="text-gray-200 italic">"{response.transcript || 'No transcript available'}"</p>
            </div>

            {/* AI Feedback */}
            {response.feedback_text && (
                <div className="bg-primary-900/20 border border-primary-700/30 p-4 rounded-lg">
                    <h5 className="text-primary-400 font-semibold mb-2">💡 AI Feedback</h5>
                    <p className="text-sm text-gray-300">{response.feedback_text}</p>
                </div>
            )}

            {/* Filler Words Breakdown (if any) */}
            {totalFillers > 0 && (
                <div className="mt-4 p-4 bg-dark-800 rounded-lg">
                    <h5 className="text-sm text-gray-400 mb-2">Filler Words Breakdown</h5>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(fillerWords).map(([word, count]) => (
                            <span key={word} className="px-3 py-1 bg-red-900/30 border border-red-700/50 rounded-full text-sm">
                                "{word}" × {count}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


const Result = () => {
    const { sessionId } = useParams();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) return <div className="min-h-screen flex items-center justify-center animate-pulse">Loading Analysis...</div>;
    if (!result) return <div className="min-h-screen flex items-center justify-center">Failed to load result.</div>;

    const handleDelete = async () => {
        if (window.confirm("Are you sure? This will permanently delete your interview data, including audio and transcripts. This action cannot be undone.")) {
            try {
                const { deleteSession } = await import('../services/api');
                await deleteSession(sessionId);
                alert("Session deleted.");
                window.location.href = '/';
            } catch (e) {
                console.error(e);
                alert("Failed to delete session.");
            }
        }
    };

    return (
        <div className="min-h-screen p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-4xl font-bold mb-2">Interview Analysis</h1>
                    <p className="text-gray-400">Session ID: {sessionId}</p>
                </div>
                <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-900/50 border border-red-500 text-red-400 rounded-lg hover:bg-red-900 transition-colors flex items-center gap-2"
                >
                    <AlertTriangle size={16} /> Delete Data
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                {/* Overall Score */}
                <div className="glass-panel p-8 flex flex-col items-center justify-center">
                    <div className="w-40 h-40 rounded-full border-8 border-primary-500 flex items-center justify-center mb-4 relative">
                        <span className="text-5xl font-bold">{Math.round(result.overall_score || 0)}%</span>
                        <div className="absolute inset-0 border-8 border-t-transparent border-primary-400/30 rounded-full animate-spin-slow" />
                    </div>
                    <h3 className="text-xl font-semibold">Overall Match</h3>
                </div>

                {/* Radar Chart */}
                <div className="glass-panel p-4 col-span-2 h-80">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={result.category_scores || []}>
                            <PolarGrid stroke="#4b5563" />
                            <PolarAngleAxis dataKey="name" tick={{ fill: '#9ca3af' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                            <Radar name="Student" dataKey="score" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* QUESTION BY QUESTION ANALYSIS */}
            <div className="mb-12">
                <h3 className="text-2xl font-bold mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
                    <Mic className="text-primary-400" /> Question by Question Analysis
                </h3>
                {result.responses && result.responses.length > 0 ? (
                    result.responses.map((resp, i) => (
                        <QuestionReview key={resp.id || i} response={resp} index={i} />
                    ))
                ) : (
                    <p className="text-gray-400">No responses recorded.</p>
                )}
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                <div className="glass-panel p-6">
                    <h4 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText className="text-blue-400" /> Grammar & Language</h4>
                    <p className="text-3xl font-bold mb-2">{result.detailed_breakdown?.grammar?.score || 0}/100</p>
                    <ul className="text-sm text-gray-400 list-disc pl-4 space-y-1">
                        {result.detailed_breakdown?.grammar?.issues?.map((issue, i) => <li key={i}>{issue}</li>)}
                    </ul>
                </div>
                <div className="glass-panel p-6">
                    <h4 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity className="text-green-400" /> Body Language</h4>
                    <p className="text-3xl font-bold mb-2">{result.detailed_breakdown?.body_language?.score || 0}/100</p>
                    <p className="text-sm text-gray-400">Eye Contact: {result.detailed_breakdown?.body_language?.eye_contact_avg}</p>
                    <p className="text-sm text-gray-400">Posture Alerts: {result.detailed_breakdown?.body_language?.posture_alerts}</p>
                    <p className="text-sm text-gray-400">Fidget Score: {result.detailed_breakdown?.body_language?.fidget_score}</p>
                </div>
                <div className="glass-panel p-6">
                    <h4 className="text-lg font-bold mb-4 flex items-center gap-2"><Mic className="text-purple-400" /> Content Quality</h4>
                    <p className="text-3xl font-bold mb-2">{result.detailed_breakdown?.content?.score || 0}/100</p>
                    <p className="text-sm text-gray-400">STAR Method: {result.detailed_breakdown?.content?.star_method_usage}</p>
                </div>

                {/* Cognitive Load Analysis */}
                <div className="glass-panel p-6 col-span-1 lg:col-span-3 bg-red-900/20 border border-red-500/30">
                    <h4 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-400">🧠 Stress & Cognitive Load Analysis</h4>
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-2xl font-bold">{result.detailed_breakdown?.stress_analysis?.level || 'N/A'} Stress Detected</p>
                            <p className="text-gray-400">{result.detailed_breakdown?.stress_analysis?.insight || 'Analysis pending...'}</p>
                        </div>
                        <div className="text-4xl font-bold text-red-500">{result.detailed_breakdown?.stress_analysis?.score || 0}/100</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Detailed Feedback */}
                <div className="glass-panel p-8">
                    <h3 className="text-2xl font-bold mb-6">Strengths & Improvements</h3>
                    <div className="space-y-6">
                        {result.strengths?.map((text, i) => (
                            <div key={i} className="flex gap-4 items-start">
                                <CheckCircle className="text-green-500 shrink-0" />
                                <p className="text-lg">{text}</p>
                            </div>
                        ))}
                        {result.areas_for_improvement?.map((text, i) => (
                            <div key={i} className="flex gap-4 items-start">
                                <AlertTriangle className="text-yellow-500 shrink-0" />
                                <p className="text-lg">{text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Learning Path */}
                <div className="glass-panel p-8">
                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <BookOpen className="text-purple-400" /> Recommended Learning
                    </h3>
                    <ul className="space-y-4">
                        {result.learning_path?.map((item, i) => (
                            <li key={i} className="p-4 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors cursor-pointer">
                                <h4 className="font-semibold text-primary-400">{item.title}</h4>
                                <p className="text-sm text-gray-400">{item.type} • {item.duration}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Result;
