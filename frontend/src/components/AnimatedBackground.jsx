import React from 'react';

const AnimatedBackground = () => {
    return (
        <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0f] via-[#111118] to-[#0c0c0f]" />

            {/* Subtle grid */}
            <div
                className="absolute inset-0 opacity-[0.015]"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
                    backgroundSize: '64px 64px'
                }}
            />

            {/* Top accent glow */}
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px]"
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.06) 0%, transparent 70%)'
                }}
            />

            {/* Side accent */}
            <div
                className="absolute top-1/3 right-0 w-[300px] h-[400px]"
                style={{
                    background: 'radial-gradient(ellipse at right, rgba(139, 92, 246, 0.04) 0%, transparent 70%)'
                }}
            />
        </div>
    );
};

export default AnimatedBackground;
