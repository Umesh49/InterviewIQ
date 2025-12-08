import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Trash2, AlertTriangle, CheckCircle, ArrowLeft, Lock, Database, FileText, MessageSquare } from 'lucide-react';
import { deleteAllData } from '../services/api';

const Privacy = () => {
    const navigate = useNavigate();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [result, setResult] = useState(null);

    const handleDeleteAll = async () => {
        if (confirmText !== 'DELETE') return;

        setIsDeleting(true);
        try {
            const data = await deleteAllData();
            setResult({
                success: true,
                message: 'All data permanently deleted',
                deleted: data.deleted
            });
            setShowConfirm(false);
            setConfirmText('');
        } catch (error) {
            setResult({
                success: false,
                message: error.response?.data?.error || 'Failed to delete data'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-screen px-6 py-8 max-w-4xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft size={18} />
                    Back
                </button>
                <div className="flex items-center gap-3 mb-2">
                    <Shield className="text-blue-400" size={28} />
                    <h1 className="text-2xl font-bold">Your Privacy</h1>
                </div>
                <p className="text-zinc-400">Manage your data and privacy settings</p>
            </motion.div>

            {/* Privacy Info Cards */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card p-5"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <Lock className="text-green-400" size={20} />
                        <h3 className="font-semibold">Data Security</h3>
                    </div>
                    <p className="text-sm text-zinc-400">
                        Your data is stored locally and never shared with third parties. We use industry-standard encryption.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="card p-5"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <Database className="text-purple-400" size={20} />
                        <h3 className="font-semibold">What We Store</h3>
                    </div>
                    <ul className="text-sm text-zinc-400 space-y-1">
                        <li className="flex items-center gap-2"><FileText size={14} /> Uploaded resumes</li>
                        <li className="flex items-center gap-2"><MessageSquare size={14} /> Interview recordings & responses</li>
                    </ul>
                </motion.div>
            </div>

            {/* Delete Data Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card p-6 border-red-500/20"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <Trash2 className="text-red-400" size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold">Delete All Data</h3>
                        <p className="text-sm text-zinc-500">Permanently remove all your data</p>
                    </div>
                </div>

                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-red-400 mt-0.5" size={18} />
                        <div className="text-sm">
                            <p className="text-red-300 font-medium mb-1">This action cannot be undone</p>
                            <p className="text-zinc-400">This will permanently delete:</p>
                            <ul className="text-zinc-500 mt-2 space-y-1">
                                <li>• All uploaded resumes and files</li>
                                <li>• All interview sessions and history</li>
                                <li>• All AI feedback and scores</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {!showConfirm ? (
                    <button
                        onClick={() => setShowConfirm(true)}
                        className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                    >
                        <Trash2 size={18} />
                        Delete All My Data
                    </button>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400">
                            Type <span className="text-white font-mono bg-zinc-800 px-2 py-0.5 rounded">DELETE</span> to confirm:
                        </p>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Type DELETE to confirm"
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-red-500 focus:outline-none"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={handleDeleteAll}
                                disabled={confirmText !== 'DELETE' || isDeleting}
                                className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={18} />
                                        Confirm Delete
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Result Message */}
            {result && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-6 p-5 rounded-xl border ${result.success
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        {result.success ? (
                            <CheckCircle className="text-green-400" size={24} />
                        ) : (
                            <AlertTriangle className="text-red-400" size={24} />
                        )}
                        <div>
                            <p className={`font-medium ${result.success ? 'text-green-300' : 'text-red-300'}`}>
                                {result.message}
                            </p>
                            {result.deleted && (
                                <p className="text-sm text-zinc-400 mt-1">
                                    Deleted: {result.deleted.resumes} resumes, {result.deleted.sessions} sessions, {result.deleted.responses} responses
                                </p>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default Privacy;
