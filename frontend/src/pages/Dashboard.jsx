import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getStudentProgress, uploadResume, createInterview, getResumes, getInterviewHistory } from '../services/api';
import { TrendingUp, Award, Clock, Upload, Play, Briefcase, BarChart3, UserCheck, FileText, History, Eye, ChevronRight } from 'lucide-react';

const Dashboard = () => {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Interview Setup State
    // Resume Selection State
    const [previousResumes, setPreviousResumes] = useState([]);
    const [useExistingResume, setUseExistingResume] = useState(false);
    const [resumeFile, setResumeFile] = useState(null);
    const [resumeId, setResumeId] = useState(null);
    const [position, setPosition] = useState('');
    const [difficulty, setDifficulty] = useState('Medium');
    const [experienceLevel, setExperienceLevel] = useState('0-2 years');
    const [isUploading, setIsUploading] = useState(false);
    const [isStarting, setIsStarting] = useState(false);

    // Interview History State
    const [interviewHistory, setInterviewHistory] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const progress = await getStudentProgress();
                setData(progress || []);
            } catch (e) {
                console.error(e);
                setData([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        // Fetch user's passed resumes
        const fetchResumes = async () => {
            try {
                const resumes = await getResumes();
                setPreviousResumes(resumes);
                if (resumes.length > 0) {
                    setUseExistingResume(true);
                    setResumeId(resumes[0].id); // Default to latest
                }
            } catch (e) { console.error("Failed to load resumes", e); }
        };
        fetchResumes();

        // Fetch interview history
        const fetchHistory = async () => {
            try {
                const sessions = await getInterviewHistory();
                // Sort by created_at descending (most recent first)
                const sorted = (sessions || []).sort((a, b) =>
                    new Date(b.created_at) - new Date(a.created_at)
                );
                setInterviewHistory(sorted);
            } catch (e) { console.error("Failed to load history", e); }
        };
        fetchHistory();
    }, []);

    const handleResumeUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setResumeFile(file);
        setIsUploading(true);

        try {
            const result = await uploadResume(file);
            setResumeId(result.id);
            alert('Resume uploaded successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to upload resume');
        } finally {
            setIsUploading(false);
        }
    };

    const validatePosition = (pos) => {
        const trimmed = pos.trim();
        if (trimmed.length < 3) {
            return 'Position must be at least 3 characters long';
        }
        if (trimmed.length > 100) {
            return 'Position must be less than 100 characters';
        }
        // Allow letters, spaces, hyphens, and common punctuation
        if (!/^[a-zA-Z\s\-\/\(\)&,.]+$/.test(trimmed)) {
            return 'Position can only contain letters, spaces, hyphens, and basic punctuation';
        }
        return null;
    };

    const handleStartInterview = async () => {
        if (!resumeId) {
            alert('Please upload a resume first');
            return;
        }

        const positionError = validatePosition(position);
        if (positionError) {
            alert(positionError);
            return;
        }

        setIsStarting(true);
        try {
            const session = await createInterview(resumeId, position.trim(), difficulty, experienceLevel);
            navigate(`/interview/${session.id}`);
        } catch (err) {
            console.error(err);
            alert('Failed to create interview session');
        } finally {
            setIsStarting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-xl">Loading Dashboard...</div>;

    return (
        <div className="min-h-screen p-8 max-w-7xl mx-auto">
            <h1 className="text-4xl font-bold mb-8">Interview Dashboard</h1>

            {/* Interview Setup Section */}
            <div className="glass-panel p-8 mb-12">
                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                    <Play className="text-green-400" /> Start New Interview
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    {/* Resume Upload / Select */}
                    <div className="space-y-2">
                        <label className="block text-sm text-gray-400 flex justify-between">
                            <span>Resume</span>
                            {previousResumes.length > 0 && (
                                <button
                                    onClick={() => setUseExistingResume(!useExistingResume)}
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                    {useExistingResume ? 'Upload New' : 'Select Existing'}
                                </button>
                            )}
                        </label>

                        {useExistingResume && previousResumes.length > 0 ? (
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <select
                                    value={resumeId || ''}
                                    onChange={(e) => setResumeId(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-gray-600 rounded-lg focus:border-primary-500 outline-none appearance-none"
                                >
                                    {previousResumes.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.file.split('/').pop().substring(0, 20)}... ({new Date(r.created_at).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                                <Upload size={20} />
                                <span>{resumeFile ? resumeFile.name : 'Choose File'}</span>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={handleResumeUpload}
                                    disabled={isUploading}
                                />
                            </label>
                        )}

                        {isUploading && <p className="text-sm text-yellow-400">Uploading...</p>}
                        {!isUploading && !useExistingResume && resumeId && <p className="text-sm text-green-400">✓ Resume ready</p>}
                    </div>

                    {/* Position - Text Input */}
                    <div className="space-y-2">
                        <label className="block text-sm text-gray-400">Position</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                value={position}
                                onChange={(e) => setPosition(e.target.value)}
                                placeholder="e.g., Software Engineer"
                                className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-gray-600 rounded-lg focus:border-primary-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Experience Level */}
                    <div className="space-y-2">
                        <label className="block text-sm text-gray-400">Experience</label>
                        <div className="relative">
                            <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <select
                                value={experienceLevel}
                                onChange={(e) => setExperienceLevel(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-gray-600 rounded-lg focus:border-primary-500 outline-none appearance-none"
                            >
                                <option>0-2 years</option>
                                <option>3-5 years</option>
                                <option>5-10 years</option>
                                <option>10+ years</option>
                            </select>
                        </div>
                    </div>

                    {/* Difficulty */}
                    <div className="space-y-2">
                        <label className="block text-sm text-gray-400">Difficulty</label>
                        <div className="relative">
                            <BarChart3 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-gray-600 rounded-lg focus:border-primary-500 outline-none appearance-none"
                            >
                                <option>Easy</option>
                                <option>Medium</option>
                                <option>Hard</option>
                            </select>
                        </div>
                    </div>

                    {/* Start Button */}
                    <div className="flex items-end">
                        <button
                            onClick={handleStartInterview}
                            disabled={!resumeId || isStarting || !position.trim()}
                            className="w-full py-3 px-6 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                        >
                            <Play size={20} />
                            {isStarting ? 'Starting...' : 'Start Interview'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <h2 className="text-2xl font-semibold mb-6">Your Progress</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="glass-panel p-6 flex items-center gap-4">
                    <div className="p-4 bg-green-900/50 rounded-full text-green-400"><TrendingUp size={32} /></div>
                    <div>
                        <p className="text-gray-400">Total Sessions</p>
                        <h3 className="text-3xl font-bold">{data.length}</h3>
                    </div>
                </div>
                <div className="glass-panel p-6 flex items-center gap-4">
                    <div className="p-4 bg-blue-900/50 rounded-full text-blue-400"><Award size={32} /></div>
                    <div>
                        <p className="text-gray-400">Avg Score</p>
                        <h3 className="text-3xl font-bold">
                            {data.length > 0 ? Math.round(data.reduce((a, b) => a + b.overall, 0) / data.length) : 0}%
                        </h3>
                    </div>
                </div>
                <div className="glass-panel p-6 flex items-center gap-4">
                    <div className="p-4 bg-purple-900/50 rounded-full text-purple-400"><Clock size={32} /></div>
                    <div>
                        <p className="text-gray-400">Practice Time</p>
                        <h3 className="text-3xl font-bold">{data.length * 15}m</h3>
                    </div>
                </div>
            </div>

            {/* Interview History Section */}
            <div className="glass-panel p-8 mb-12">
                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                    <History className="text-purple-400" /> Past Interviews
                </h2>

                {interviewHistory.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {interviewHistory.map((session) => (
                            <div
                                key={session.id}
                                className="flex items-center justify-between p-4 bg-dark-800 rounded-lg border border-gray-700 hover:border-primary-500 transition-colors"
                            >
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg">{session.position || 'Interview'}</h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                                        <span>{new Date(session.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs ${session.difficulty === 'Hard' ? 'bg-red-900/50 text-red-300' :
                                            session.difficulty === 'Easy' ? 'bg-green-900/50 text-green-300' :
                                                'bg-yellow-900/50 text-yellow-300'
                                            }`}>
                                            {session.difficulty}
                                        </span>
                                        <span className="text-gray-500">{session.status}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {/* Score Badge */}
                                    <div className={`text-center ${(session.overall_score || 0) >= 70 ? 'text-green-400' :
                                        (session.overall_score || 0) >= 50 ? 'text-yellow-400' :
                                            'text-gray-400'
                                        }`}>
                                        <p className="text-2xl font-bold">{Math.round(session.overall_score || 0)}%</p>
                                        <p className="text-xs text-gray-500">Score</p>
                                    </div>

                                    {/* View Results Button */}
                                    <button
                                        onClick={() => navigate(`/result/${session.id}`)}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors"
                                    >
                                        <Eye size={18} />
                                        View Results
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-400">
                        <History size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No past interviews yet</p>
                        <p className="text-sm mt-2">Complete your first interview to see your history here!</p>
                    </div>
                )}
            </div>

            {/* Growth Chart */}
            {data.length > 0 && (
                <div className="glass-panel p-8 h-96">
                    <h3 className="text-xl font-semibold mb-6">Performance Trends</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" domain={[0, 100]} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }}
                                itemStyle={{ color: '#e5e7eb' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="overall" stroke="#10b981" strokeWidth={2} name="Overall Score" />
                            <Line type="monotone" dataKey="communication" stroke="#3b82f6" strokeWidth={2} name="Communication" />
                            <Line type="monotone" dataKey="body_language" stroke="#8b5cf6" strokeWidth={2} name="Body Language" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
