import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Star, HelpCircle, User, FileText, ArrowLeft, ChevronDown, ChevronRight, CheckCircle, Lightbulb } from 'lucide-react';
import { getResources } from '../services/api';
import Loading from '../components/Loading';

const iconMap = {
    BookOpen, Star, HelpCircle, User, FileText, Lightbulb
};

const Resources = () => {
    const navigate = useNavigate();
    const [resources, setResources] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await getResources();
                setResources(result);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <Loading message="Loading resources..." />;

    const sections = resources ? Object.entries(resources) : [];

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
                        <h1 className="text-2xl sm:text-3xl font-bold">Interview Resources</h1>
                        <p className="text-sm text-zinc-500">Everything you need to ace your interview</p>
                    </div>
                </motion.div>

                {/* Resource Cards */}
                <div className="space-y-4">
                    {sections.map(([key, section], index) => {
                        const IconComponent = iconMap[section.icon] || BookOpen;
                        const isActive = activeSection === key;

                        return (
                            <motion.div
                                key={key}
                                className="card overflow-hidden"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                {/* Section Header */}
                                <motion.button
                                    className="w-full p-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                                    onClick={() => setActiveSection(isActive ? null : key)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                            <IconComponent className="text-blue-400" size={22} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-base">{section.title}</h3>
                                            {section.description && (
                                                <p className="text-sm text-zinc-500">{section.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <motion.div
                                        animate={{ rotate: isActive ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronDown size={20} className="text-zinc-500" />
                                    </motion.div>
                                </motion.button>

                                {/* Section Content */}
                                <AnimatePresence>
                                    {isActive && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-5 pb-5 border-t border-zinc-800/50">
                                                <ResourceContent section={section} sectionKey={key} />
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

const ResourceContent = ({ section, sectionKey }) => {
    switch (sectionKey) {
        case 'interview_basics':
            return (
                <div className="pt-4 space-y-4">
                    {section.items?.map((item, i) => (
                        <div key={i} className="p-4 rounded-xl bg-white/[0.02]">
                            <h4 className="font-medium mb-2">{item.title}</h4>
                            <p className="text-sm text-zinc-400 mb-3">{item.description}</p>
                            <ul className="space-y-1.5">
                                {(item.tips || item.examples)?.map((tip, j) => (
                                    <li key={j} className="text-sm text-zinc-300 flex items-start gap-2">
                                        <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            );

        case 'star_method':
            return (
                <div className="pt-4">
                    {/* STAR Components */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        {Object.entries(section.components || {}).map(([letter, data]) => (
                            <div key={letter} className="p-3 rounded-xl bg-white/[0.02] text-center">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                                    <span className="font-bold text-blue-400">{letter}</span>
                                </div>
                                <p className="font-medium text-sm">{data.name}</p>
                                <p className="text-xs text-zinc-500 mt-1">{data.tip}</p>
                            </div>
                        ))}
                    </div>

                    {/* Example */}
                    {section.example && (
                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/20 to-transparent border border-blue-500/20">
                            <p className="text-sm text-blue-400 mb-3">Example Question:</p>
                            <p className="font-medium mb-4">"{section.example.question}"</p>
                            <div className="space-y-2">
                                {Object.entries(section.example.answer || {}).map(([letter, text]) => (
                                    <div key={letter} className="flex gap-2">
                                        <span className="font-bold text-blue-400 shrink-0">{letter}:</span>
                                        <p className="text-sm text-zinc-300">{text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );

        case 'common_questions':
            return (
                <div className="pt-4 space-y-4">
                    {section.categories?.map((cat, i) => (
                        <div key={i}>
                            <h4 className="font-medium text-sm text-zinc-400 mb-2">{cat.name}</h4>
                            <ul className="space-y-2">
                                {cat.questions?.map((q, j) => (
                                    <li key={j} className="text-sm text-zinc-300 flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.02]">
                                        <ChevronRight size={14} className="text-zinc-500" />
                                        {q}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            );

        case 'body_language':
            return (
                <div className="pt-4 space-y-3">
                    {section.tips?.map((tip, i) => (
                        <div key={i} className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                <p className="text-xs text-green-400 mb-1">✓ Do</p>
                                <p className="text-sm">{tip.do}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <p className="text-xs text-red-400 mb-1">✗ Don't</p>
                                <p className="text-sm">{tip.dont}</p>
                            </div>
                        </div>
                    ))}
                </div>
            );

        case 'resume_tips':
            return (
                <ul className="pt-4 space-y-2">
                    {section.tips?.map((tip, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.02]">
                            <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                            {tip}
                        </li>
                    ))}
                </ul>
            );

        default:
            return <p className="pt-4 text-sm text-zinc-500">Content coming soon...</p>;
    }
};

export default Resources;
