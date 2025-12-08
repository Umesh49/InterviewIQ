import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap, ArrowLeft, Play, Clock, RefreshCw,
    CheckCircle, ChevronRight, Timer, Briefcase, Brain, Code, LayoutGrid, BarChart3, Circle
} from 'lucide-react';
import { getQuickPractice } from '../services/api';
import { LoadingSpinner } from '../components/Loading';
import IconSelect from '../components/IconSelect';

const QuickPractice = () => {
    const navigate = useNavigate();
    const [questions, setQuestions] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentQ, setCurrentQ] = useState(0);
    const [started, setStarted] = useState(false);
    const [filters, setFilters] = useState({ category: '', difficulty: '' });

    const startPractice = async () => {
        setLoading(true);
        try {
            const data = await getQuickPractice(filters.category, filters.difficulty);
            setQuestions(data);
            setCurrentQ(0);
            setStarted(true);
        } catch (e) {
            console.error(e);
            alert('Failed to load questions');
        } finally {
            setLoading(false);
        }
    };

    const resetPractice = () => {
        setQuestions(null);
        setStarted(false);
        setCurrentQ(0);
    };

    return (
        <div className="min-h-screen px-4 sm:px-6 py-6 sm:py-8">
            <div className="max-w-3xl mx-auto">
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
                        <h1 className="text-2xl sm:text-3xl font-bold">Quick Practice</h1>
                        <p className="text-sm text-zinc-500">5-minute drill with 3 questions</p>
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">
                    {!started ? (
                        /* Setup Screen */
                        <motion.div
                            key="setup"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            {/* Info Card */}
                            <div className="card p-6 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Zap className="text-blue-400" size={28} />
                                </div>
                                <h2 className="text-xl font-bold mb-2">5-Minute Drill</h2>
                                <p className="text-zinc-400 mb-4">
                                    Quick practice with 3 random questions. Perfect when you're short on time!
                                </p>
                                <div className="flex items-center justify-center gap-4 text-sm text-zinc-500">
                                    <span className="flex items-center gap-1">
                                        <Clock size={14} /> ~5 minutes
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <CheckCircle size={14} /> 3 questions
                                    </span>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="card p-5">
                                <h3 className="font-semibold mb-4">Customize (Optional)</h3>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-zinc-400 block mb-2">Category</label>
                                        <IconSelect
                                            value={filters.category}
                                            onChange={(val) => setFilters(f => ({ ...f, category: val }))}
                                            placeholder="All Categories"
                                            options={[
                                                { value: '', label: 'All Categories', icon: LayoutGrid },
                                                { value: 'hr', label: 'HR Questions', icon: Briefcase },
                                                { value: 'behavioral', label: 'Behavioral', icon: Brain },
                                                { value: 'technical', label: 'Technical', icon: Code },
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-zinc-400 block mb-2">Difficulty</label>
                                        <IconSelect
                                            value={filters.difficulty}
                                            onChange={(val) => setFilters(f => ({ ...f, difficulty: val }))}
                                            placeholder="All Levels"
                                            options={[
                                                { value: '', label: 'All Levels', icon: BarChart3 },
                                                { value: 'easy', label: 'Easy', icon: Circle },
                                                { value: 'medium', label: 'Medium', icon: Circle },
                                                { value: 'hard', label: 'Hard', icon: Circle },
                                            ]}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Start Button */}
                            <motion.button
                                onClick={startPractice}
                                disabled={loading}
                                className="btn-primary w-full py-4 text-lg"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {loading ? (
                                    <LoadingSpinner size="sm" />
                                ) : (
                                    <>
                                        <Play size={20} />
                                        Start Practice
                                    </>
                                )}
                            </motion.button>
                        </motion.div>
                    ) : (
                        /* Practice Screen */
                        <motion.div
                            key="practice"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            {/* Progress */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-500">
                                    Question {currentQ + 1} of {questions?.questions?.length || 3}
                                </span>
                                <div className="flex items-center gap-1">
                                    <Timer size={14} className="text-zinc-500" />
                                    <span className="text-sm text-zinc-400">
                                        {questions?.questions?.[currentQ]?.time_limit}s
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${((currentQ + 1) / (questions?.questions?.length || 3)) * 100}%` }}
                                />
                            </div>

                            {/* Question Card */}
                            <AnimatePresence mode="wait">
                                {questions?.questions?.[currentQ] && (
                                    <motion.div
                                        key={currentQ}
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                        className="card p-6"
                                    >
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className={`text-xs px-2.5 py-1 rounded-full ${questions.questions[currentQ].category === 'Technical' ? 'bg-purple-500/20 text-purple-400' :
                                                questions.questions[currentQ].category === 'Behavioral' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                {questions.questions[currentQ].category}
                                            </span>
                                            <span className={`text-xs px-2.5 py-1 rounded-full ${questions.questions[currentQ].difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' :
                                                questions.questions[currentQ].difficulty === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                {questions.questions[currentQ].difficulty}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-semibold leading-relaxed">
                                            {questions.questions[currentQ].text}
                                        </h2>
                                        <p className="text-sm text-zinc-500 mt-4">
                                            💡 Think about your answer, then practice saying it out loud!
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Navigation */}
                            <div className="flex gap-3">
                                {currentQ < (questions?.questions?.length || 3) - 1 ? (
                                    <motion.button
                                        onClick={() => setCurrentQ(q => q + 1)}
                                        className="btn-primary flex-1 py-3"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        Next Question
                                        <ChevronRight size={18} />
                                    </motion.button>
                                ) : (
                                    <motion.button
                                        onClick={resetPractice}
                                        className="btn-primary flex-1 py-3 bg-green-500 hover:bg-green-600"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <CheckCircle size={18} />
                                        Finish & Try Again
                                    </motion.button>
                                )}
                            </div>

                            {/* Restart Button */}
                            <button
                                onClick={resetPractice}
                                className="w-full py-3 text-sm text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={14} />
                                Get New Questions
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default QuickPractice;
