import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import gsap from 'gsap';
import { ArrowRight, Play, Video, Mic, BarChart, Users, TrendingUp, Zap, Star, Eye, Brain, ChevronRight } from 'lucide-react';

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.3 }
    }
};

const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    }
};

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};

const Home = () => {
    const heroRef = useRef(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.to('.main-card-glow', {
                opacity: 0.6,
                scale: 1.05,
                duration: 2,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut'
            });
            gsap.to('.float-element', {
                y: -8,
                duration: 3,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                stagger: 0.5
            });
        }, heroRef);
        return () => ctx.revert();
    }, []);

    return (
        <div className="min-h-screen" ref={heroRef}>
            {/* Hero */}
            <section className="min-h-screen px-4 sm:px-6 py-8 flex flex-col">
                {/* Header */}
                <motion.div
                    className="text-center mb-8 sm:mb-10"
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                >
                    <motion.h1
                        variants={fadeUp}
                        className="text-3xl sm:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 tracking-tight"
                    >
                        Practice interviews
                        <br />
                        <span className="gradient-text">like never before</span>
                    </motion.h1>
                    <motion.p
                        variants={fadeUp}
                        className="text-base sm:text-lg text-zinc-400 max-w-xl mx-auto mb-6 sm:mb-8 px-4"
                    >
                        AI-powered mock interviews with real-time feedback
                    </motion.p>
                    <motion.div variants={fadeUp}>
                        <Link to="/dashboard">
                            <motion.button
                                className="btn-primary text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4"
                                whileHover={{ scale: 1.03, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Play size={18} fill="currentColor" />
                                Start Practicing
                            </motion.button>
                        </Link>
                    </motion.div>
                </motion.div>

                {/* Bento Grid - Responsive */}
                <motion.div
                    className="flex-1 max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto lg:grid-rows-3"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {/* Main Feature Card */}
                    <motion.div
                        variants={cardVariants}
                        whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
                        className="sm:col-span-2 lg:row-span-2 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-600/20 via-blue-800/10 to-transparent border border-blue-500/20 p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden cursor-pointer group min-h-[200px] sm:min-h-[280px]"
                    >
                        <div className="main-card-glow absolute -top-20 -right-20 w-60 h-60 bg-blue-500/20 rounded-full blur-[80px] pointer-events-none" />

                        <div className="relative z-10">
                            <motion.div
                                className="w-12 sm:w-14 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-blue-500/20 flex items-center justify-center mb-3 sm:mb-4 float-element"
                                whileHover={{ rotate: 5, scale: 1.1 }}
                            >
                                <Video size={24} className="text-blue-400 sm:hidden" />
                                <Video size={28} className="text-blue-400 hidden sm:block" />
                            </motion.div>
                            <h3 className="text-xl sm:text-2xl font-semibold mb-2">Live Interview Simulation</h3>
                            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">Practice with an AI interviewer that adapts to your responses in real-time.</p>
                        </div>

                        <motion.div
                            className="relative z-10 flex items-center gap-3 sm:gap-4 mt-4 sm:mt-6"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1 }}
                        >
                            <div className="flex -space-x-2">
                                {['😊', '🎯', '💪'].map((emoji, i) => (
                                    <motion.div
                                        key={i}
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-700 border-2 border-zinc-900 flex items-center justify-center text-xs sm:text-sm"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 1.2 + i * 0.1, type: 'spring' }}
                                    >
                                        {emoji}
                                    </motion.div>
                                ))}
                            </div>
                            <span className="text-xs sm:text-sm text-zinc-500">10K+ sessions</span>
                        </motion.div>

                        <motion.div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight size={20} className="text-blue-400 sm:hidden" />
                            <ArrowRight size={24} className="text-blue-400 hidden sm:block" />
                        </motion.div>
                    </motion.div>

                    {/* Speech Analysis */}
                    <motion.div
                        variants={cardVariants}
                        whileHover={{ scale: 1.03, y: -4 }}
                        className="rounded-2xl sm:rounded-3xl bg-zinc-900/80 border border-zinc-800 p-4 sm:p-5 flex flex-col justify-between group hover:border-purple-500/30 transition-colors cursor-pointer min-h-[140px] sm:min-h-[160px]"
                    >
                        <motion.div
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-500/20 flex items-center justify-center mb-2 sm:mb-3 float-element"
                            whileHover={{ rotate: -5 }}
                        >
                            <Mic size={18} className="text-purple-400 sm:hidden" />
                            <Mic size={20} className="text-purple-400 hidden sm:block" />
                        </motion.div>
                        <div>
                            <h3 className="font-semibold text-sm sm:text-base mb-1">Speech Analysis</h3>
                            <p className="text-xs sm:text-sm text-zinc-500">Pace, clarity, filler words</p>
                        </div>
                        <div className="flex items-end gap-1 h-6 sm:h-8 mt-2 sm:mt-3">
                            {[40, 70, 55, 80, 45, 65, 50].map((h, i) => (
                                <motion.div
                                    key={i}
                                    className="flex-1 bg-purple-500/40 rounded-full group-hover:bg-purple-500/60 transition-colors"
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    transition={{ delay: 0.8 + i * 0.05, duration: 0.5, ease: 'backOut' }}
                                />
                            ))}
                        </div>
                    </motion.div>

                    {/* Body Language */}
                    <motion.div
                        variants={cardVariants}
                        whileHover={{ scale: 1.03, y: -4 }}
                        className="rounded-2xl sm:rounded-3xl bg-zinc-900/80 border border-zinc-800 p-4 sm:p-5 flex flex-col justify-between group hover:border-green-500/30 transition-colors cursor-pointer min-h-[140px] sm:min-h-[160px]"
                    >
                        <motion.div
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-green-500/20 flex items-center justify-center mb-2 sm:mb-3 float-element"
                            whileHover={{ rotate: 5 }}
                        >
                            <Eye size={18} className="text-green-400 sm:hidden" />
                            <Eye size={20} className="text-green-400 hidden sm:block" />
                        </motion.div>
                        <div>
                            <h3 className="font-semibold text-sm sm:text-base mb-1">Body Language</h3>
                            <p className="text-xs sm:text-sm text-zinc-500">Posture & eye contact</p>
                        </div>
                        <div className="flex items-center gap-2 mt-2 sm:mt-3">
                            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
                                    initial={{ width: 0 }}
                                    animate={{ width: '85%' }}
                                    transition={{ delay: 1, duration: 1, ease: 'easeOut' }}
                                />
                            </div>
                            <motion.span
                                className="text-xs sm:text-sm font-medium text-green-400"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1.5 }}
                            >
                                85%
                            </motion.span>
                        </div>
                    </motion.div>

                    {/* Progress Stats */}
                    <motion.div
                        variants={cardVariants}
                        whileHover={{ scale: 1.02 }}
                        className="sm:col-span-2 lg:col-span-1 lg:row-span-2 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 p-4 sm:p-5 flex flex-col group hover:border-zinc-600 transition-colors"
                    >
                        <h3 className="text-xs sm:text-sm text-zinc-400 uppercase tracking-wide mb-4 sm:mb-5">Your Progress</h3>
                        <div className="flex-1 flex flex-col justify-around gap-3 sm:gap-0">
                            <AnimatedStat label="Sessions" value="12" change="+3 this week" delay={0.9} />
                            <AnimatedStat label="Avg Score" value="78%" change="+12% improved" delay={1} />
                            <AnimatedStat label="Best Area" value="Clarity" delay={1.1} />
                        </div>
                    </motion.div>

                    {/* AI Insights */}
                    <motion.div
                        variants={cardVariants}
                        whileHover={{ scale: 1.03, y: -4 }}
                        className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-900/30 to-orange-900/10 border border-amber-500/20 p-4 sm:p-5 flex flex-col justify-between group hover:border-amber-500/40 transition-colors cursor-pointer min-h-[120px] sm:min-h-[140px]"
                    >
                        <motion.div
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/20 flex items-center justify-center mb-2 float-element"
                            whileHover={{ rotate: -5 }}
                        >
                            <Brain size={18} className="text-amber-400 sm:hidden" />
                            <Brain size={20} className="text-amber-400 hidden sm:block" />
                        </motion.div>
                        <div>
                            <h3 className="font-semibold text-sm sm:text-base mb-1">AI Insights</h3>
                            <p className="text-xs sm:text-sm text-zinc-500">Personalized tips</p>
                        </div>
                    </motion.div>

                    {/* Rating Bar */}
                    <motion.div
                        variants={cardVariants}
                        whileHover={{ scale: 1.01 }}
                        className="sm:col-span-2 rounded-2xl sm:rounded-3xl bg-zinc-900/80 border border-zinc-800 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 group hover:border-amber-500/20 transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="flex">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 1.2 + i * 0.1, type: 'spring' }}
                                    >
                                        <Star size={20} className="text-amber-400 sm:hidden" fill="currentColor" />
                                        <Star size={24} className="text-amber-400 hidden sm:block" fill="currentColor" />
                                    </motion.div>
                                ))}
                            </div>
                            <div>
                                <p className="font-semibold text-sm sm:text-base">4.9 out of 5</p>
                                <p className="text-xs sm:text-sm text-zinc-500">from 2K+ reviews</p>
                            </div>
                        </div>
                        <motion.div
                            className="flex items-center gap-2 text-zinc-500 group-hover:text-amber-400 transition-colors"
                            whileHover={{ x: 4 }}
                        >
                            <span className="text-xs sm:text-sm">See reviews</span>
                            <ChevronRight size={14} className="sm:hidden" />
                            <ChevronRight size={16} className="hidden sm:block" />
                        </motion.div>
                    </motion.div>
                </motion.div>
            </section>

            {/* Features */}
            <section className="py-16 sm:py-24 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <AnimatedSection>
                        <div className="text-center mb-12 sm:mb-16">
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">How it works</h2>
                            <p className="text-sm sm:text-base text-zinc-400">Three simple steps to interview success</p>
                        </div>
                    </AnimatedSection>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                        <AnimatedStep num="1" title="Upload Resume" desc="We generate personalized questions based on your background." delay={0} />
                        <AnimatedStep num="2" title="Practice" desc="Answer questions while AI analyzes your performance live." delay={0.1} />
                        <AnimatedStep num="3" title="Improve" desc="Get detailed feedback and track progress over time." delay={0.2} />
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 sm:py-24 px-4 sm:px-6">
                <motion.div
                    className="max-w-2xl mx-auto text-center"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                        <Zap size={40} className="mx-auto mb-4 sm:mb-6 text-blue-400 sm:hidden" />
                        <Zap size={48} className="mx-auto mb-4 sm:mb-6 text-blue-400 hidden sm:block" />
                    </motion.div>
                    <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Ready to ace your interview?</h2>
                    <p className="text-sm sm:text-base text-zinc-400 mb-6 sm:mb-8">Start practicing now - it's completely free.</p>
                    <Link to="/dashboard">
                        <motion.button
                            className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-4"
                            whileHover={{ scale: 1.05, y: -3 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            Get Started <ArrowRight size={18} className="sm:hidden" />
                            <ArrowRight size={20} className="hidden sm:block" />
                        </motion.button>
                    </Link>
                </motion.div>
            </section>
        </div>
    );
};

const AnimatedStat = ({ label, value, change, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay, duration: 0.5 }}
    >
        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-xl sm:text-2xl font-bold">{value}</p>
        {change && <p className="text-xs text-green-400 mt-0.5">{change}</p>}
    </motion.div>
);

const AnimatedSection = ({ children }) => {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-100px' });
    return (
        <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
            {children}
        </motion.div>
    );
};

const AnimatedStep = ({ num, title, desc, delay }) => {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-50px' });

    return (
        <motion.div
            ref={ref}
            className="text-center"
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay }}
        >
            <motion.div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mx-auto mb-4 sm:mb-5 font-bold text-lg sm:text-xl shadow-lg shadow-blue-500/25"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
            >
                {num}
            </motion.div>
            <h3 className="font-semibold text-base sm:text-lg mb-2">{title}</h3>
            <p className="text-xs sm:text-sm text-zinc-400">{desc}</p>
        </motion.div>
    );
};

export default Home;
