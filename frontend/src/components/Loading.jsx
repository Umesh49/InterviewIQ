import React from 'react';
import { motion } from 'framer-motion';

/**
 * Professional loading component with animated logo and progress indicator
 * Used across the application for consistent loading experience
 * Uses fixed positioning to cover entire screen including footer
 */
const Loading = ({ message = 'Loading...' }) => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
            {/* Ambient glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]" />
            </div>

            {/* Content */}
            <div className="relative z-10 text-center">
                {/* Animated Logo with rotating square */}
                <div className="relative mb-8 w-20 h-20 mx-auto">
                    {/* Rotating outer square */}
                    <motion.div
                        className="absolute inset-0 rounded-2xl border-2 border-blue-500/30"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                    />

                    {/* Second rotating square (opposite direction) */}
                    <motion.div
                        className="absolute inset-2 rounded-xl border-2 border-blue-400/20"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    />

                    {/* Center icon with pulse */}
                    <motion.div
                        className="absolute inset-0 flex items-center justify-center"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <span className="text-white font-bold text-lg">AI</span>
                        </div>
                    </motion.div>
                </div>

                {/* Brand */}
                <motion.h2
                    className="text-xl font-semibold mb-2 text-white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    Interview Coach
                </motion.h2>

                {/* Loading text */}
                <motion.p
                    className="text-zinc-500 text-sm mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {message}
                </motion.p>

                {/* Progress dots */}
                <div className="flex items-center justify-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-2 h-2 rounded-full bg-blue-500"
                            animate={{
                                opacity: [0.3, 1, 0.3],
                                scale: [0.8, 1, 0.8]
                            }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: i * 0.2,
                                ease: 'easeInOut'
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * Inline loading spinner for smaller contexts
 * Used in buttons, cards, etc.
 */
export const LoadingSpinner = ({ size = 'md', className = '' }) => {
    const sizes = {
        sm: 'w-4 h-4 border',
        md: 'w-6 h-6 border-2',
        lg: 'w-10 h-10 border-2'
    };

    return (
        <motion.div
            className={`${sizes[size]} border-blue-500 border-t-transparent rounded-full ${className}`}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
    );
};

/**
 * Skeleton loader for content placeholders
 */
export const Skeleton = ({ className = '', variant = 'text' }) => {
    const variants = {
        text: 'h-4 rounded',
        title: 'h-6 rounded',
        avatar: 'w-10 h-10 rounded-full',
        card: 'h-32 rounded-xl',
        button: 'h-10 w-24 rounded-lg'
    };

    return (
        <motion.div
            className={`bg-zinc-800 ${variants[variant]} ${className}`}
            role="status"
            aria-label="Loading content"
            aria-busy="true"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />);
};

export default Loading;
