import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, ArrowLeft, ChevronDown, Copy, CheckCircle,
    Lightbulb, Star
} from 'lucide-react';
import { getAnswerTemplates } from '../services/api';
import Loading from '../components/Loading';

const AnswerTemplates = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getAnswerTemplates();
                setTemplates(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const copyTemplate = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return <Loading message="Loading answer templates..." />;

    const templateList = Object.entries(templates);

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
                        <h1 className="text-2xl sm:text-3xl font-bold">Answer Templates</h1>
                        <p className="text-sm text-zinc-500">Ready-to-use answer structures</p>
                    </div>
                </motion.div>

                {/* Templates */}
                <div className="space-y-4">
                    {templateList.map(([key, template], index) => {
                        const isActive = activeTemplate === key;

                        return (
                            <motion.div
                                key={key}
                                className="card overflow-hidden"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                {/* Question Header */}
                                <button
                                    className="w-full p-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                                    onClick={() => setActiveTemplate(isActive ? null : key)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${template.difficulty === 'Easy' ? 'bg-green-500/20' :
                                                template.difficulty === 'Medium' ? 'bg-amber-500/20' :
                                                    'bg-red-500/20'
                                            }`}>
                                            <FileText size={18} className={
                                                template.difficulty === 'Easy' ? 'text-green-400' :
                                                    template.difficulty === 'Medium' ? 'text-amber-400' :
                                                        'text-red-400'
                                            } />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{template.question}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-zinc-500">{template.category}</span>
                                                <span className="text-xs text-zinc-600">•</span>
                                                <span className={`text-xs ${template.difficulty === 'Easy' ? 'text-green-400' :
                                                        template.difficulty === 'Medium' ? 'text-amber-400' :
                                                            'text-red-400'
                                                    }`}>{template.difficulty}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <motion.div animate={{ rotate: isActive ? 180 : 0 }}>
                                        <ChevronDown size={20} className="text-zinc-500" />
                                    </motion.div>
                                </button>

                                {/* Template Content */}
                                <AnimatePresence>
                                    {isActive && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-5 pb-5 border-t border-zinc-800/50 pt-4">
                                                {/* Structure */}
                                                <div className="mb-5">
                                                    <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                                                        <Star size={14} className="text-amber-400" />
                                                        Answer Structure
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {template.structure.map((line, i) => (
                                                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                                                                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-medium shrink-0">
                                                                    {i + 1}
                                                                </span>
                                                                <p className="text-sm">{line}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Example */}
                                                <div className="mb-5">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                                            <Lightbulb size={14} className="text-green-400" />
                                                            Example Answer
                                                        </h4>
                                                        <button
                                                            onClick={() => copyTemplate(template.example)}
                                                            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-blue-400 transition-colors"
                                                        >
                                                            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                                                            {copied ? 'Copied!' : 'Copy'}
                                                        </button>
                                                    </div>
                                                    <div className="p-4 rounded-lg bg-gradient-to-r from-blue-900/20 to-transparent border border-blue-500/20">
                                                        <p className="text-sm text-zinc-300 leading-relaxed">{template.example}</p>
                                                    </div>
                                                </div>

                                                {/* Tips */}
                                                <div>
                                                    <h4 className="text-sm font-medium text-zinc-400 mb-3">💡 Tips</h4>
                                                    <ul className="space-y-1.5">
                                                        {template.tips.map((tip, i) => (
                                                            <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                                                                <span className="text-blue-400">•</span>
                                                                {tip}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AnswerTemplates;
