import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FileSearch, ArrowLeft, Upload, CheckCircle, AlertCircle,
    Target, Zap, FileText, Briefcase
} from 'lucide-react';
import { getResumes, getATSScore } from '../services/api';
import Loading from '../components/Loading';
import IconSelect from '../components/IconSelect';

const ATSScanner = () => {
    const navigate = useNavigate();
    const [resumes, setResumes] = useState([]);
    const [selectedResume, setSelectedResume] = useState(null);
    const [jobDescription, setJobDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        const fetchResumes = async () => {
            try {
                const data = await getResumes();
                setResumes(data || []);
                if (data?.length > 0) {
                    setSelectedResume(data[0].id);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchResumes();
    }, []);

    const handleAnalyze = async () => {
        if (!selectedResume || !jobDescription.trim()) return;

        setAnalyzing(true);
        setResult(null);

        try {
            const data = await getATSScore(selectedResume, jobDescription);
            setResult(data);
        } catch (e) {
            console.error(e);
            alert('Failed to analyze resume');
        } finally {
            setAnalyzing(false);
        }
    };

    if (loading) return <Loading message="Loading your resumes..." />;

    return (
        <div className="min-h-screen px-4 sm:px-6 py-6 sm:py-8">
            <div className="max-w-4xl mx-auto">
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
                        <h1 className="text-2xl sm:text-3xl font-bold">ATS Resume Scanner</h1>
                        <p className="text-sm text-zinc-500">Check how well your resume matches a job description</p>
                    </div>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Input Section */}
                    <motion.div
                        className="space-y-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        {/* Resume Selection */}
                        <div className="card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="text-blue-400" size={18} />
                                <h3 className="font-semibold">Select Resume</h3>
                            </div>

                            {resumes.length > 0 ? (
                                <IconSelect
                                    value={selectedResume || ''}
                                    onChange={setSelectedResume}
                                    placeholder="Select a resume"
                                    options={resumes.map((r) => ({
                                        value: r.id,
                                        label: r.file.split('/').pop().substring(0, 30) + '...',
                                        icon: FileText
                                    }))}
                                />
                            ) : (
                                <div className="text-center py-6 text-zinc-500">
                                    <Upload size={24} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No resumes uploaded yet</p>
                                    <button
                                        onClick={() => navigate('/dashboard')}
                                        className="text-blue-400 text-sm mt-2 hover:underline"
                                    >
                                        Upload from Dashboard
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Job Description */}
                        <div className="card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Briefcase className="text-purple-400" size={18} />
                                <h3 className="font-semibold">Job Description</h3>
                            </div>
                            <textarea
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste the job description here..."
                                className="w-full h-48 p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        {/* Analyze Button */}
                        <motion.button
                            onClick={handleAnalyze}
                            disabled={!selectedResume || !jobDescription.trim() || analyzing}
                            className="btn-primary w-full py-4 disabled:opacity-40 disabled:cursor-not-allowed"
                            whileHover={{ scale: selectedResume && jobDescription.trim() ? 1.02 : 1 }}
                            whileTap={{ scale: selectedResume && jobDescription.trim() ? 0.98 : 1 }}
                        >
                            <FileSearch size={18} />
                            {analyzing ? 'Analyzing...' : 'Analyze Match'}
                        </motion.button>
                    </motion.div>

                    {/* Results Section */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        {result ? (
                            <div className="space-y-4">
                                {/* Score Card */}
                                <div className={`card p-6 text-center border-2 ${result.score >= 70 ? 'border-green-500/30 bg-green-500/5' :
                                    result.score >= 50 ? 'border-amber-500/30 bg-amber-500/5' :
                                        'border-red-500/30 bg-red-500/5'
                                    }`}>
                                    <div className="relative w-24 h-24 mx-auto mb-4">
                                        <svg className="w-24 h-24 transform -rotate-90">
                                            <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="8" fill="none" className="text-zinc-800" />
                                            <motion.circle
                                                cx="48" cy="48" r="42"
                                                stroke="currentColor"
                                                strokeWidth="8"
                                                fill="none"
                                                strokeLinecap="round"
                                                className={result.score >= 70 ? 'text-green-500' : result.score >= 50 ? 'text-amber-500' : 'text-red-500'}
                                                initial={{ strokeDasharray: '0 264' }}
                                                animate={{ strokeDasharray: `${result.score * 2.64} 264` }}
                                                transition={{ duration: 1, ease: 'easeOut' }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-2xl font-bold">{result.score}%</span>
                                        </div>
                                    </div>
                                    <h3 className="font-semibold text-lg mb-1">
                                        {result.score >= 70 ? 'Great Match!' : result.score >= 50 ? 'Good Match' : 'Needs Work'}
                                    </h3>
                                    <p className="text-sm text-zinc-500">
                                        {result.matched_count} of {result.total_jd_keywords} keywords matched
                                    </p>
                                </div>

                                {/* Matching Keywords */}
                                {result.matching_keywords?.length > 0 && (
                                    <div className="card p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <CheckCircle className="text-green-400" size={16} />
                                            <h4 className="font-medium text-sm">Matching Keywords</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {result.matching_keywords.map((kw) => (
                                                <span key={kw} className="px-2.5 py-1 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Missing Keywords */}
                                {result.missing_keywords?.length > 0 && (
                                    <div className="card p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <AlertCircle className="text-amber-400" size={16} />
                                            <h4 className="font-medium text-sm">Missing Keywords</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {result.missing_keywords.map((kw) => (
                                                <span key={kw} className="px-2.5 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Suggestions */}
                                {result.suggestions?.length > 0 && (
                                    <div className="card p-5 bg-gradient-to-r from-blue-900/20 to-transparent border-blue-500/20">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap className="text-blue-400" size={16} />
                                            <h4 className="font-medium text-sm">Suggestions</h4>
                                        </div>
                                        <ul className="space-y-2">
                                            {result.suggestions.map((s, i) => (
                                                <li key={i} className="text-sm text-zinc-300">{s}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="card p-8 text-center">
                                <Target size={48} className="mx-auto text-zinc-600 mb-4" />
                                <h3 className="font-semibold mb-2">No Results Yet</h3>
                                <p className="text-sm text-zinc-500">
                                    Select a resume and paste a job description to see how well they match.
                                </p>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default ATSScanner;
