import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, AlertCircle, Shirt, Brain, CheckSquare, Building2, Mail,
    ChevronDown, ChevronRight, Lightbulb, XCircle, ThumbsUp, Clock, Camera
} from 'lucide-react';

const guides = [
    {
        id: 'mistakes',
        title: 'Common Mistakes',
        icon: XCircle,
        color: 'red',
        description: 'Avoid these pitfalls freshers often make',
        content: [
            { title: 'Arriving Late', tip: 'Arrive 10-15 mins early. Plan your route beforehand.' },
            { title: 'Poor Body Language', tip: 'Maintain eye contact, sit straight, avoid fidgeting.' },
            { title: 'Not Researching the Company', tip: 'Know their products, mission, recent news.' },
            { title: 'Speaking Too Fast', tip: 'Slow down, pause between points, breathe.' },
            { title: 'One-Word Answers', tip: 'Elaborate with examples using STAR method.' },
            { title: 'Saying "I Don\'t Know"', tip: 'Instead say "I haven\'t worked on this, but I would approach it by..."' },
            { title: 'Negative Talk About College/Professors', tip: 'Stay positive, focus on learnings.' },
            { title: 'Not Asking Questions', tip: 'Prepare 2-3 thoughtful questions about the role.' },
            { title: 'Lying on Resume', tip: 'Be honest. Interviewers can easily verify claims.' },
            { title: 'Checking Phone', tip: 'Keep phone on silent and away. Full attention on interviewer.' }
        ]
    },
    {
        id: 'dresscode',
        title: 'Dress Code Guide',
        icon: Shirt,
        color: 'blue',
        description: 'What to wear for different interview types',
        content: [
            { title: 'Corporate/IT Companies', tip: 'Formal shirt, trousers. For women: formal blouse, trousers or kurta.' },
            { title: 'Startups', tip: 'Smart casual - neat polo/shirt, chinos. Avoid jeans with holes.' },
            { title: 'Virtual Interviews', tip: 'Dress fully formal (not just top). Solid colors work best on camera.' },
            { title: 'Colors to Prefer', tip: 'Blue, white, grey, black. Avoid loud patterns or bright colors.' },
            { title: 'Grooming', tip: 'Neat hair, trimmed nails, minimal jewelry, light makeup.' },
            { title: 'Footwear', tip: 'Formal shoes - black or brown. Clean and polished.' },
            { title: 'Accessories', tip: 'Simple watch, minimal accessories. Avoid flashy items.' },
            { title: 'What NOT to Wear', tip: 'Shorts, t-shirts with logos, flip-flops, heavy perfume.' }
        ]
    },
    {
        id: 'anxiety',
        title: 'Nervousness Tips',
        icon: Brain,
        color: 'purple',
        description: 'Manage interview anxiety and stay calm',
        content: [
            { title: 'Deep Breathing', tip: 'Box breathing: Inhale 4s → Hold 4s → Exhale 4s → Hold 4s. Repeat 5x.' },
            { title: 'Power Pose', tip: '2 mins before interview: Stand tall, hands on hips. Boosts confidence.' },
            { title: 'Positive Visualization', tip: 'Imagine yourself succeeding, shaking hands, getting the offer.' },
            { title: 'Prepare Thoroughly', tip: 'Preparation reduces anxiety. Practice answers aloud.' },
            { title: 'Arrive Early', tip: 'Rushing increases stress. Give yourself buffer time.' },
            { title: 'It\'s Okay to Pause', tip: 'Taking 5 seconds to think shows you\'re thoughtful, not slow.' },
            { title: 'Reframe Nervousness', tip: 'Tell yourself "I\'m excited" not "I\'m nervous" - same physical feeling!' },
            { title: 'Remember: They Want You to Succeed', tip: 'Interviewers want to find the right person. They\'re rooting for you.' }
        ]
    },
    {
        id: 'checklist',
        title: 'Interview Day Checklist',
        icon: CheckSquare,
        color: 'green',
        description: 'Everything you need before the interview',
        content: [
            { title: 'Documents', tip: '3-4 copies of resume, certificates, ID proof, pen & notepad.' },
            { title: 'Research Done', tip: 'Company info, job role, interviewer\'s LinkedIn (if known).' },
            { title: 'Outfit Ready', tip: 'Clothes ironed, shoes polished, minimal accessories.' },
            { title: 'Route Planned', tip: 'Know exact location, parking, check traffic. Leave 30 mins early.' },
            { title: 'Questions Prepared', tip: '2-3 questions to ask the interviewer about role/team.' },
            { title: 'Phone Charged', tip: 'For emergency contact or finding location. Put on silent before interview.' },
            { title: 'Breakfast/Meal', tip: 'Don\'t go hungry. Eat something light, avoid heavy foods.' },
            { title: 'Positive Mindset', tip: 'You got the interview - you\'re already qualified. Go show them!' }
        ]
    },
    {
        id: 'virtual',
        title: 'Virtual Interview Tips',
        icon: Camera,
        color: 'cyan',
        description: 'Ace your video call interviews',
        content: [
            { title: 'Test Technology', tip: 'Check camera, mic, internet 30 mins before. Have backup ready.' },
            { title: 'Lighting', tip: 'Face a window or light source. Avoid backlighting.' },
            { title: 'Background', tip: 'Clean, professional. Plain wall or virtual background.' },
            { title: 'Eye Contact', tip: 'Look at camera, not screen. Place sticky note near camera as reminder.' },
            { title: 'Dress Fully', tip: 'Dress formally top to bottom. You might need to stand up!' },
            { title: 'Eliminate Distractions', tip: 'Mute notifications, close other apps, inform family.' },
            { title: 'Have Notes Ready', tip: 'Keep resume, job description, key points visible but not obviously reading.' },
            { title: 'Body Language', tip: 'Nod, smile, sit straight. These matter even on video.' }
        ]
    },
    {
        id: 'intro',
        title: 'Self-Introduction Templates',
        icon: ThumbsUp,
        color: 'amber',
        description: '"Tell me about yourself" templates for freshers',
        content: [
            { title: 'Opening', tip: '"Hi, I\'m [Name]. I recently completed my [Degree] from [College] with [CGPA/%]."' },
            { title: 'Academic Highlight', tip: '"During my studies, I specialized in [Subject] and worked on [Project Name]."' },
            { title: 'Skills', tip: '"I have hands-on experience with [Technology/Skill] which I learned through [Internship/Project]."' },
            { title: 'Achievement', tip: '"I was recognized for [Award/Competition] where I demonstrated [Quality]."' },
            { title: 'Why This Role', tip: '"I\'m excited about this role at [Company] because [Specific Reason]."' },
            { title: 'Closing', tip: '"I believe my [Skills] and enthusiasm make me a good fit for this position."' },
            { title: 'Keep it Under 2 Minutes', tip: 'Practice with timer. Concise is better than rambling.' },
            { title: 'Customize for Each Company', tip: 'Adjust "Why This Role" section for each interview.' }
        ]
    },
    {
        id: 'email',
        title: 'Email Templates',
        icon: Mail,
        color: 'pink',
        description: 'Professional follow-up and thank you emails',
        content: [
            { title: 'Thank You Email (Same Day)', tip: 'Subject: "Thank you for the opportunity - [Your Name]"\nSend within 24 hours of interview.' },
            { title: 'Thank You Body', tip: '"Dear [Name], Thank you for taking the time to discuss the [Role] position. I enjoyed learning about [specific thing mentioned]. I\'m very excited about the opportunity..."' },
            { title: 'Follow-Up (After 1 Week)', tip: 'Subject: "Following up on [Role] interview - [Your Name]"\n"I wanted to check in on the status of my application..."' },
            { title: 'Accepting Offer', tip: '"I am thrilled to accept the offer for [Position]. I look forward to starting on [Date] and contributing to the team."' },
            { title: 'Declining Politely', tip: '"Thank you for the offer. After careful consideration, I have decided to pursue another opportunity that aligns more closely with my career goals at this time."' },
            { title: 'Requesting Extension', tip: '"Thank you for the offer. Could I please have until [Date] to make my decision? I want to ensure I make the right choice."' },
            { title: 'Always Proofread', tip: 'Check spelling, recipient name, company name before sending.' },
            { title: 'Keep it Short', tip: 'Emails should be 3-5 sentences max. Get to the point.' }
        ]
    }
];

const colorClasses = {
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20'
};

const InterviewGuide = () => {
    const navigate = useNavigate();
    const [expandedGuide, setExpandedGuide] = useState(null);

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
                    <Lightbulb className="text-amber-400" size={28} />
                    <h1 className="text-2xl font-bold">Interview Guide for Freshers</h1>
                </div>
                <p className="text-zinc-400">Everything you need to ace your first interview</p>
            </motion.div>

            {/* Guide Cards */}
            <div className="space-y-4">
                {guides.map((guide, index) => (
                    <motion.div
                        key={guide.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="card overflow-hidden"
                    >
                        <button
                            onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
                            className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[guide.color]}`}>
                                    <guide.icon size={24} />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-semibold">{guide.title}</h3>
                                    <p className="text-sm text-zinc-500">{guide.description}</p>
                                </div>
                            </div>
                            <motion.div
                                animate={{ rotate: expandedGuide === guide.id ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown size={20} className="text-zinc-500" />
                            </motion.div>
                        </button>

                        <AnimatePresence>
                            {expandedGuide === guide.id && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-5 pb-5 pt-2 border-t border-zinc-800">
                                        <div className="grid gap-3">
                                            {guide.content.map((item, i) => (
                                                <div key={i} className="flex gap-3 p-3 bg-zinc-900/50 rounded-lg">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${colorClasses[guide.color]}`}>
                                                        <span className="text-xs font-bold">{i + 1}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{item.title}</p>
                                                        <p className="text-sm text-zinc-400 mt-1 whitespace-pre-line">{item.tip}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ))}
            </div>

            {/* Quick Tip */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8 p-5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl"
            >
                <div className="flex items-start gap-3">
                    <AlertCircle className="text-blue-400 mt-0.5" size={20} />
                    <div>
                        <p className="font-medium text-blue-300">Pro Tip</p>
                        <p className="text-sm text-zinc-400 mt-1">
                            Practice with our Mock Interview feature to apply these tips in a realistic setting.
                            The more you practice, the more confident you'll become!
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default InterviewGuide;
