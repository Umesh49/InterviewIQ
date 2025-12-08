import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowLeft, ChevronRight, CheckCircle, HelpCircle, Star } from 'lucide-react';
import { getCompanyPrep } from '../services/api';
import Loading from '../components/Loading';

const CompanyPrep = () => {
    const navigate = useNavigate();
    const [companies, setCompanies] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedCompany, setSelectedCompany] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getCompanyPrep();
                setCompanies(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <Loading message="Loading company insights..." />;

    const companyList = Object.entries(companies);
    const activeCompany = selectedCompany ? companies[selectedCompany] : null;

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
                        <h1 className="text-2xl sm:text-3xl font-bold">Company Prep Bank</h1>
                        <p className="text-sm text-zinc-500">Prepare for specific companies</p>
                    </div>
                </motion.div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Company List */}
                    <motion.div
                        className="space-y-3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">Select Company</h3>
                        {companyList.map(([key, company], i) => (
                            <motion.button
                                key={key}
                                onClick={() => setSelectedCompany(key)}
                                className={`w-full p-4 rounded-xl text-left flex items-center gap-4 transition-all ${selectedCompany === key
                                    ? 'bg-blue-500/20 border border-blue-500/30'
                                    : 'bg-white/[0.02] border border-zinc-800 hover:bg-white/[0.05]'
                                    }`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                whileHover={{ x: 4 }}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${selectedCompany === key ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                    {company.logo}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{company.name}</p>
                                    <p className="text-xs text-zinc-500 truncate">{company.culture}</p>
                                </div>
                                <ChevronRight size={16} className={selectedCompany === key ? 'text-blue-400' : 'text-zinc-600'} />
                            </motion.button>
                        ))}
                    </motion.div>

                    {/* Company Details */}
                    <div className="lg:col-span-2">
                        <AnimatePresence mode="wait">
                            {activeCompany ? (
                                <motion.div
                                    key={selectedCompany}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    {/* Company Header */}
                                    <div className="card p-5">
                                        <h2 className="text-xl font-bold mb-2">{activeCompany.name}</h2>
                                        <p className="text-sm text-zinc-400 mb-4">{activeCompany.culture}</p>

                                        {/* Hiring Process */}
                                        <div className="flex flex-wrap gap-2">
                                            {activeCompany.hiring_process.map((step, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-medium">
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-sm">{step}</span>
                                                    {i < activeCompany.hiring_process.length - 1 && (
                                                        <ChevronRight size={14} className="text-zinc-600" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tips */}
                                    <div className="card p-5">
                                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                                            <Star className="text-amber-400" size={16} />
                                            Pro Tips
                                        </h3>
                                        <ul className="space-y-2">
                                            {activeCompany.tips.map((tip, i) => (
                                                <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                                                    <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                                                    {tip}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Common Questions */}
                                    <div className="card p-5">
                                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                                            <HelpCircle className="text-blue-400" size={16} />
                                            Commonly Asked Questions
                                        </h3>
                                        <div className="space-y-3">
                                            {activeCompany.common_questions.map((q, i) => (
                                                <div key={i} className="p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${q.category === 'Technical' ? 'bg-purple-500/20 text-purple-400' :
                                                            q.category === 'Behavioral' ? 'bg-amber-500/20 text-amber-400' :
                                                                'bg-blue-500/20 text-blue-400'
                                                            }`}>
                                                            {q.category}
                                                        </span>
                                                        <span className={`text-xs ${q.frequency === 'Very Common' ? 'text-green-400' : 'text-zinc-500'
                                                            }`}>
                                                            {q.frequency}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium">{q.question}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="card p-8 text-center"
                                >
                                    <Building2 size={48} className="mx-auto text-zinc-600 mb-4" />
                                    <h3 className="font-semibold mb-2">Select a Company</h3>
                                    <p className="text-sm text-zinc-500">
                                        Choose a company from the list to see interview questions and preparation tips.
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyPrep;
