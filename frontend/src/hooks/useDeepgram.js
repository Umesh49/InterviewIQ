import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for Deepgram real-time speech-to-text
 * Features:
 * - Indian English (en-IN) support
 * - MediaRecorder for efficient streaming (replaces ScriptProcessor)
 * - Real-time interim and final transcripts
 * - Technical term correction
 */
const useDeepgram = ({ onTranscript } = {}) => {
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState(null);

    const socketRef = useRef(null);
    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const keepAliveIntervalRef = useRef(null);
    const onTranscriptRef = useRef(onTranscript);

    // Update ref when callback changes to avoid stale closures in socket callbacks
    useEffect(() => {
        onTranscriptRef.current = onTranscript;
    }, [onTranscript]);

    const correctTechTerms = (text) => {
        const corrections = {
            'tango': 'Django', 'jungle': 'Django', 'jango': 'Django', 'd jango': 'Django',
            'react js': 'React.js', 'no js': 'Node.js', 'node js': 'Node.js',
            'angular js': 'Angular.js', 'view js': 'Vue.js', 'next js': 'Next.js',
            'express js': 'Express.js', 'flask': 'Flask', 'spring boot': 'Spring Boot',
            'dot net': '.NET', 'asp net': 'ASP.NET', 'fast api': 'FastAPI',
            'ruby on rails': 'Ruby on Rails', 'laravel': 'Laravel', 'bootstrap': 'Bootstrap',
            'tailwind': 'Tailwind', 'tailwind css': 'TailwindCSS', 'material ui': 'Material UI',
            'chakra ui': 'Chakra UI', 'jquery': 'jQuery', 'j query': 'jQuery',
            'python': 'Python', 'java': 'Java', 'javascript': 'JavaScript',
            'java script': 'JavaScript', 'typescript': 'TypeScript', 'type script': 'TypeScript',
            'c plus plus': 'C++', 'c++': 'C++', 'c sharp': 'C#',
            'golang': 'Golang', 'go lang': 'Golang', 'rust': 'Rust', 'swift': 'Swift',
            'kotlin': 'Kotlin', 'scala': 'Scala', 'ruby': 'Ruby', 'php': 'PHP',
            'pie chart': 'PyTorch', 'pie torch': 'PyTorch', 'tensor flow': 'TensorFlow',
            'care us': 'Keras', 'curious': 'Keras', 'scikit learn': 'Scikit-learn',
            'psychic learn': 'Scikit-learn', 'open cv': 'OpenCV', 'open sea v': 'OpenCV',
            'num pie': 'NumPy', 'pandas': 'Pandas', 'matplotlib': 'Matplotlib',
            'see born': 'Seaborn', 'nlp': 'NLP', 'machine learning': 'Machine Learning',
            'deep learning': 'Deep Learning', 'neural network': 'neural network',
            'cnn': 'CNN', 'rnn': 'RNN', 'lstm': 'LSTM', 'transformer': 'Transformer',
            'gpt': 'GPT', 'bert': 'BERT', 'llm': 'LLM', 'chat gpt': 'ChatGPT',
            'post grass': 'PostgreSQL', 'post gress': 'PostgreSQL', 'postgres sequel': 'PostgreSQL',
            'post grey': 'PostgreSQL', 'mongo db': 'MongoDB', 'my sequel': 'MySQL',
            'my sql': 'MySQL', 'sequel server': 'SQL Server', 'read is': 'Redis',
            'read this': 'Redis', 'dynamodb': 'DynamoDB', 'dynamo db': 'DynamoDB',
            'fire base': 'Firebase', 'fire store': 'Firestore', 'elastic search': 'Elasticsearch',
            'cassandra': 'Cassandra', 'oracle': 'Oracle', 'sqlite': 'SQLite',
            'sequel lite': 'SQLite', 'mariadb': 'MariaDB', 'neo4j': 'Neo4j',
            'aws': 'AWS', 'azure': 'Azure', 'gcp': 'GCP', 'google cloud': 'Google Cloud',
            'ci cd': 'CI/CD', 'dev ops': 'DevOps', 'docker': 'Docker',
            'kubernetes': 'Kubernetes', 'cooper nettys': 'Kubernetes', 'cube nettys': 'Kubernetes',
            'k8s': 'K8s', 'jenkins': 'Jenkins', 'get hub': 'GitHub', 'git lab': 'GitLab',
            'bitbucket': 'Bitbucket', 'terraform': 'Terraform', 'answer ball': 'Ansible',
            'ansibel': 'Ansible', 'ec2': 'EC2', 'e c 2': 'EC2', 's3': 'S3', 's 3': 'S3',
            'lambda': 'Lambda', 'nginx': 'Nginx', 'apache': 'Apache',
            'api': 'API', 'rest api': 'REST API', 'restful': 'RESTful',
            'graphql': 'GraphQL', 'graph ql': 'GraphQL', 'websocket': 'WebSocket',
            'microservices': 'microservices', 'oop': 'OOP', 'oops': 'OOPs',
            'dsa': 'DSA', 'd s a': 'DSA', 'html': 'HTML', 'css': 'CSS',
            'jason': 'JSON', 'j son': 'JSON', 'xml': 'XML', 'yaml': 'YAML',
            'sequel': 'SQL', 'no sequel': 'NoSQL', 'crud': 'CRUD', 'mvc': 'MVC',
            'jwt': 'JWT', 'j w t': 'JWT', 'oauth': 'OAuth', 'o auth': 'OAuth',
            'btech': 'B.Tech', 'b tech': 'B.Tech', 'mtech': 'M.Tech', 'm tech': 'M.Tech',
            'mba': 'MBA', 'mca': 'MCA', 'bca': 'BCA', 'cgpa': 'CGPA',
            'lakh': 'lakh', 'lack': 'lakh', 'crore': 'crore', 'ctc': 'CTC',
            'see tc': 'CTC', 'lpa': 'LPA', 'l p a': 'LPA', 'fresher': 'fresher',
            'iit': 'IIT', 'i i t': 'IIT', 'nit': 'NIT', 'n i t': 'NIT',
            'tcs': 'TCS', 'infosys': 'Infosys', 'wipro': 'Wipro', 'google': 'Google',
            'microsoft': 'Microsoft', 'amazon': 'Amazon', 'meta': 'Meta',
            'array': 'array', 'linked list': 'linked list', 'stack': 'stack',
            'queue': 'queue', 'hash map': 'HashMap', 'binary tree': 'binary tree',
            'bst': 'BST', 'heap': 'heap', 'graph': 'graph', 'trie': 'Trie',
            'binary search': 'binary search', 'merge sort': 'merge sort',
            'quick sort': 'quick sort', 'bfs': 'BFS', 'dfs': 'DFS',
            'dynamic programming': 'dynamic programming', 'dp': 'DP',
            'big o': 'Big O', 'o of n': 'O(n)', 'time complexity': 'time complexity',
            'git': 'Git', 'github': 'GitHub', 'gitlab': 'GitLab',
            'star method': 'STAR method', 'scrum': 'Scrum', 'agile': 'Agile'
        };

        const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let correctedText = text;

        Object.entries(corrections).forEach(([wrong, right]) => {
            const regex = new RegExp(`\\b${escapeRegExp(wrong)}\\b`, 'gi');
            correctedText = correctedText.replace(regex, right);
        });

        return correctedText;
    };

    const startListening = useCallback(async () => {
        try {
            setError(null);
            setTranscript('');
            setInterimTranscript('');

            console.log('[Deepgram] Requesting microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            streamRef.current = stream;
            console.log('[Deepgram] Microphone access granted');

            const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
            if (!apiKey) {
                throw new Error('Deepgram API key not found. Set VITE_DEEPGRAM_API_KEY in .env');
            }

            console.log('[Deepgram] Connecting to WebSocket...');
            const socket = new WebSocket(
                `wss://api.deepgram.com/v1/listen?` +
                `model=nova-2&` +
                `language=en-IN&` +
                `smart_format=true&` +
                `punctuate=true&` +
                `interim_results=true&` +
                `endpointing=4000`, // Increased to 4s to allow for thinking pauses
                ['token', apiKey]
            );

            socket.onopen = () => {
                console.log('[Deepgram] WebSocket connected');
                setIsListening(true);

                // Use MediaRecorder for efficient encoding (Opus/WebM)
                // This is much better than raw PCM/ScriptProcessor
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: 'audio/webm'
                });
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.addEventListener('dataavailable', (event) => {
                    if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                        socket.send(event.data);
                    }
                });

                mediaRecorder.start(250); // Send larger chunks (250ms) for better efficiency
                console.log('[Deepgram] MediaRecorder started');

                keepAliveIntervalRef.current = setInterval(() => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'KeepAlive' }));
                    }
                }, 5000);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.channel?.alternatives?.[0]) {
                        const result = data.channel.alternatives[0];
                        const text = result.transcript || '';

                        if (text.trim()) {
                            const corrected = correctTechTerms(text);

                            // Log for debugging
                            if (data.is_final) {
                                console.log(`[Deepgram] ✅ FINAL: '${corrected}' (${result.confidence.toFixed(3)})`);
                            } else {
                                // Less noisy logging for interim
                                // console.log(`[Deepgram] ⚡ Interim: '${corrected}'`);
                            }

                            if (data.is_final) {
                                setTranscript(prev => prev + corrected + ' ');
                                setInterimTranscript('');

                                if (onTranscriptRef.current) {
                                    onTranscriptRef.current({
                                        transcript: corrected,
                                        isFinal: true
                                    });
                                }
                            } else {
                                setInterimTranscript(corrected);

                                if (onTranscriptRef.current) {
                                    onTranscriptRef.current({
                                        transcript: corrected,
                                        isFinal: false
                                    });
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Deepgram parse error:', err);
                }
            };

            socket.onerror = (e) => {
                console.error('[Deepgram] WebSocket error:', e);
                setError('Connection error occurred');
            };

            socket.onclose = (event) => {
                console.log(`[Deepgram] WebSocket closed (code: ${event.code})`);
                setIsListening(false);

                // Cleanup recorder if socket closes unexpectedly
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }

                if (keepAliveIntervalRef.current) {
                    clearInterval(keepAliveIntervalRef.current);
                    keepAliveIntervalRef.current = null;
                }
            };

            socketRef.current = socket;

        } catch (err) {
            console.error('[Deepgram] Start error:', err);
            setError(err.message);
            setIsListening(false);
        }
    }, []);

    const stopListening = useCallback(() => {
        console.log('[Deepgram] Stopping listening...');

        if (keepAliveIntervalRef.current) {
            clearInterval(keepAliveIntervalRef.current);
            keepAliveIntervalRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }

        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.close(1000, 'User stopped listening');
            socketRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        setIsListening(false);
        setInterimTranscript('');
    }, []);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        transcript,
        interimTranscript,
        isListening,
        error,
        startListening,
        stopListening,
        resetTranscript,
        setTranscript
    };
};

export default useDeepgram;