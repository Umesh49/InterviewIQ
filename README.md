# 🎯 InterviewIQ - AI Interview Coach

An intelligent, AI-powered mock interview platform designed to help job seekers practice and improve their interview skills through realistic simulations, real-time feedback, and comprehensive performance analytics.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Django](https://img.shields.io/badge/django-4.2-green)
![React](https://img.shields.io/badge/react-19-61dafb)
![Vite](https://img.shields.io/badge/vite-5-646CFF)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-4-06B6D4)

🌐 **[Live Demo](https://interviewiq-practice.web.app)** - *Frontend only; backend not hosted as API keys would expire. Clone the repo and add your own API keys to test the full functionality.*

---

## 📑 Table of Contents

- [What Makes This Special](#-what-makes-this-special)
- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Endpoints](#-api-endpoints)
- [Pages Overview](#-pages-overview)
- [Interview Session Features](#-interview-session-features)
- [Future Enhancements](#-future-enhancements)
- [Known Issues](#-known-issues)
- [Contributing](#-contributing)
- [Authors](#-authors)
- [License](#-license)

---

## 🌟 What Makes This Special

| Feature | Description |
|---------|-------------|
| **No Login Required** | Start practicing immediately without account creation |
| **Real-Time Voice Analysis** | Deepgram-powered STT with Indian English support + Chrome fallback |
| **AI Body Language Analysis** | Photo-based analysis using Google Gemini Vision API |
| **Multi-AI Provider System** | Automatic failover across Groq, Cerebras, Gemini, and OpenRouter |
| **Switchable STT Engines** | Toggle between Deepgram and Chrome Speech-to-Text during interviews |
| **Responsive Design** | Works seamlessly on desktop, tablet, and mobile |
| **Session Persistence** | Resume interrupted interviews from where you left off |

---

## ✨ Features

### 🎤 AI-Powered Mock Interviews
- **Smart Question Generation** - Dynamic, position-specific questions tailored to your resume
- **Duplicate Prevention** - Enhanced fuzzy matching prevents repeated questions across sessions
- **Progressive Difficulty** - Questions adapt based on experience level (0-2, 3-5, 5-10, 10+ years)
- **Multiple Categories** - Technical, Behavioral, Intro, and Project-based questions
- **Session Persistence** - Refresh-safe interviews with automatic progress restoration
- **Transaction-Safe** - Database locking prevents duplicate question creation on refresh

### 🗣️ Real-Time Voice Analysis
- **Dual STT Support** - Toggle between Deepgram and Chrome Speech-to-Text during interviews
- **Transcript Persistence** - Switching STT providers preserves your transcript
- **Indian English Support** - Deepgram configured with `en-IN` for better accent recognition
- **Auto-Scrolling Transcript** - Live transcript panel scrolls automatically as you speak
- **Fluency Metrics** - Tracks filler words, pauses, speech pace, and word count
- **Grammar Checking** - LanguageTool integration for grammar analysis
- **STAR Method Detection** - Analyzes if responses follow the Situation-Task-Action-Result structure

### 📹 AI Body Language Analysis
- **Photo-Based Analysis** - Captures periodic snapshots for Gemini Vision analysis
- **Eye Contact Tracking** - Measures gaze patterns and camera engagement
- **Posture Analysis** - Evaluates body posture and confidence signals
- **Toggle Camera Preview** - Show/hide camera preview in the right panel during interviews
- **Privacy-Focused** - Photos processed server-side, not stored permanently

### 🎨 Modern UI/UX
- **Animated Background** - Subtle grid pattern with gradient glows
- **Glassmorphic Design** - Modern card styles with backdrop blur
- **Dark Mode First** - Professional zinc-based dark theme (`#0c0c0f`)
- **Framer Motion Animations** - Smooth entrance/exit animations throughout
- **Responsive Layout** - Optimized for all screen sizes
- **Live Stats Panel** - Real-time word count and elapsed time display

### 📊 Comprehensive Analytics
- **Performance Dashboard** - Track your progress over time
- **Category Breakdown** - Scores for Communication, Content Quality, and Confidence
- **Detailed Feedback** - AI-generated insights with specific improvement suggestions
- **YouTube Resources** - Relevant learning videos based on identified weaknesses
- **Historical Trends** - View performance trends across all sessions

### 📄 ATS Resume Scanner
- **Resume Analysis** - Check how well your resume matches job descriptions
- **Direct Upload** - Upload new resumes directly from the ATS Scanner page
- **Keyword Matching** - Identify matching and missing keywords
- **Score Calculation** - Get an ATS compatibility score (0-100)
- **Actionable Suggestions** - Specific tips to improve your resume

### 🎓 Learning Resources
- **Interview Guides** - Comprehensive tips for different interview stages
- **Answer Templates** - Fill-in-the-blank templates for common questions (STAR method)
- **Company Prep** - Company-specific interview preparation
- **Quick Practice** - 3-question drill sessions for rapid skill building
- **Daily Tips** - AI-generated interview tips

### 🔒 Privacy & Security
- **Data Transparency** - Clear information about what data is stored
- **Hard Delete** - Permanently delete all your data (resumes, interviews, responses)
- **No Authentication Required** - Anonymous usage with simplified student model
- **Rate Limiting** - 100 req/hour for anonymous users
- **Input Sanitization** - HTML stripping, entity escaping, length limits
- **File Validation** - MIME type checking, extension whitelist, size limits (2MB images, 5MB docs)

### 🤖 Multi-Provider AI System

| Provider | Purpose | Features |
|----------|---------|----------|
| Groq | Primary - Fast inference | Llama models |
| Cerebras | Secondary | 14,400 req/day |
| Google Gemini | Fallback + Vision | Body language analysis |
| OpenRouter | Multi-model access | Claude, GPT-4, Llama |

> **Automatic Failover**: Seamless switching between providers when one fails.

---

## 🏗️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Django 4.2 | Web framework |
| Django REST Framework | API development |
| SQLite/PostgreSQL | Database |
| Groq/Gemini/Cerebras/OpenRouter | AI question generation & analysis |
| LanguageTool | Grammar checking |
| PDFMiner | Resume parsing |
| Gemini Vision | Body language photo analysis |

### Frontend
| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| Vite 5 | Build tool |
| TailwindCSS 4 | Styling |
| Framer Motion | Animations |
| Recharts | Data visualization |
| Deepgram SDK | Speech-to-text & text-to-speech |
| Web Speech API | Chrome STT fallback |
| Lucide React | Icons |

---

## 📁 Project Structure

```
InterviewIQ/
├── backend/
│   ├── config/                  # Django settings & configuration
│   │   ├── settings.py          # Main settings (rate limiting, CORS, etc.)
│   │   ├── urls.py              # Root URL configuration
│   │   └── wsgi.py              # WSGI entry point
│   ├── core/                    # Main application
│   │   ├── models.py            # Database models (Student, Resume, Interview, Question, Response)
│   │   ├── serializers.py       # Data serialization with validation
│   │   ├── admin.py             # Django admin configuration
│   │   ├── utils.py             # Sanitization, validation, API helpers
│   │   ├── views/               # Modular ViewSets
│   │   │   ├── student_views.py     # Student management, delete_all_data
│   │   │   ├── resume_views.py      # Resume upload, parsing, ATS scoring
│   │   │   └── interview_views.py   # Interview CRUD, questions, responses, analytics
│   │   └── services/            # Business logic & AI
│   │       ├── ai_service.py           # Multi-provider AI calls with failover
│   │       ├── interview_service.py    # Question generation & response analysis
│   │       ├── helper_functions.py     # STAR detection, metrics, tips
│   │       ├── voice_service.py        # Deepgram TTS
│   │       └── analyze_body_language.py # Gemini Vision photo analysis
│   ├── media/                   # Uploaded files (resumes)
│   ├── requirements.txt         # Python dependencies
│   └── manage.py                # Django CLI
│
├── frontend/
│   ├── public/                  # Static assets (logo)
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Loading.jsx
│   │   │   ├── IconSelect.jsx       # Custom dropdown component
│   │   │   └── AnimatedBackground.jsx
│   │   ├── pages/               # Main application pages
│   │   │   ├── Home.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Interview.jsx        # Main interview page with STT toggle
│   │   │   ├── InterviewSetup.jsx   # Pre-interview configuration
│   │   │   ├── Result.jsx           # Detailed performance analysis
│   │   │   ├── Analytics.jsx        # Historical performance trends
│   │   │   ├── ATSScanner.jsx       # Resume ATS scoring with upload
│   │   │   ├── Resources.jsx        # Interview guides hub
│   │   │   ├── InterviewGuide.jsx   # Detailed interview tips
│   │   │   ├── AnswerTemplates.jsx  # STAR method templates
│   │   │   ├── CompanyPrep.jsx      # Company-specific preparation
│   │   │   ├── QuickPractice.jsx    # 3-question drill sessions
│   │   │   └── Privacy.jsx          # Data management
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── useDeepgram.js       # Deepgram speech-to-text
│   │   │   └── usePhotoCapture.js   # Periodic photo capture for body language
│   │   └── services/            # API integration
│   │       └── api.js               # Axios-based API client
│   ├── index.html
│   └── package.json
│
├── LICENSE                      # MIT License
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### 🔑 API Keys Required

#### Backend API Keys (create `.env` in `backend/` folder)

| Key | Required | Purpose | Get it from |
|-----|----------|---------|-------------|
| `GROQ_API_KEY` | **Yes** | Primary AI (fast Llama inference) | [console.groq.com](https://console.groq.com) |
| `GEMINI_API_KEY` | **Yes** | Fallback AI + Body Language Analysis | [aistudio.google.com](https://aistudio.google.com) |
| `OPENROUTER_API_KEY` | Recommended | Access to Claude, GPT-4, Llama | [openrouter.ai](https://openrouter.ai) |
| `CEREBRAS_API_KEY` | Optional | Secondary fast inference | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| `DEEPGRAM_API_KEY` | Optional | Backend TTS (text-to-speech) | [console.deepgram.com](https://console.deepgram.com) |

#### Frontend API Keys (create `.env` in `frontend/` folder)

| Key | Required | Purpose | Get it from |
|-----|----------|---------|-------------|
| `VITE_DEEPGRAM_API_KEY` | **Yes** | Real-time speech-to-text | [console.deepgram.com](https://console.deepgram.com) |

> **Note**: The same Deepgram API key can be used for both backend and frontend.

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/Umesh49/InterviewIQ.git
cd InterviewIQ

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r backend/requirements.txt

# Create .env file in backend/ folder with your API keys
# (See API Keys Required section above)

# Run migrations
python backend/manage.py migrate

# Start server
python backend/manage.py runserver
```

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env file in frontend/ folder
echo "VITE_DEEPGRAM_API_KEY=your_deepgram_key" > .env

# Start dev server
npm run dev
```

Access the app at **http://localhost:5173**

---

## 📱 Pages Overview

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Landing page with features overview |
| Dashboard | `/dashboard` | Start interviews, view history, access features |
| Interview Setup | `/interview/:id` | Configure interview before starting |
| Interview | `/interview-session/:id` | Main AI interview with camera & STT controls |
| Results | `/result/:id` | Detailed performance analysis |
| Analytics | `/analytics` | Historical performance trends |
| ATS Scanner | `/ats-scanner` | Resume vs job description analysis with upload |
| Resources | `/resources` | Interview guides and tips hub |
| Interview Guide | `/interview-guide` | Detailed interview preparation tips |
| Templates | `/templates` | Fill-in-the-blank answer templates |
| Company Prep | `/company-prep` | Company-specific preparation |
| Quick Practice | `/quick-practice` | 3-question drill sessions |
| Privacy | `/privacy` | Data management and deletion |

---

## 🔑 API Endpoints

### Resume Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resumes/` | List all resumes |
| POST | `/api/resumes/` | Upload new resume |
| DELETE | `/api/resumes/:id/` | Delete resume |
| POST | `/api/resumes/:id/ats_score/` | Get ATS score |

### Interviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/interviews/` | Create new interview |
| POST | `/api/interviews/:id/start_interview/` | Start interview (generates questions) |
| POST | `/api/interviews/:id/submit_response/` | Submit answer with voice/body metrics |
| POST | `/api/interviews/:id/analyze_body_language/` | Analyze photos for body language |
| GET | `/api/interviews/:id/get_result/` | Get interview results |
| POST | `/api/interviews/:id/clarify_question/` | Get AI hint for current question |

### Dashboard & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/interviews/student_progress/` | Dashboard stats |
| GET | `/api/interviews/detailed_analytics/` | Full analytics with trends |
| GET | `/api/interviews/daily_tip/` | Get daily interview tip |

### Resources
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/interviews/resources/` | Interview guides |
| GET | `/api/interviews/answer_templates/` | Answer templates |
| GET | `/api/interviews/company_prep/?company=:name` | Company prep |
| POST | `/api/interviews/quick_practice/` | Quick 3-question drill |

### Privacy
| Method | Endpoint | Description |
|--------|----------|-------------|
| DELETE | `/api/students/delete_all_data/` | Hard delete all user data |

---

## 🎮 Interview Session Features

### Camera Preview
- Visible in right panel above transcript
- Toggle show/hide with ✕ button
- Mirrored display for natural feel

### STT Provider Toggle
- Switch between **Deepgram** and **Chrome** during interview
- Transcript persists when switching providers
- Located in top-left corner during recording

### Live Transcript Panel
- Auto-scrolls as you speak
- Shows interim (gray) and final (white) text
- Displays word count and elapsed time
- Always visible during recording

---

## 💡 Future Enhancements

> These are ideas that could extend the platform. Contributions welcome!

| Category | Ideas |
|----------|-------|
| **Interview Experience** | Video recording, multi-language support (Hindi, Tamil, Telugu), custom question banks, interview scheduling |
| **AI Features** | AI interviewer avatar, industry-specific modes, resume builder, LinkedIn integration |
| **Technical** | User authentication, PWA support, offline mode, analytics export (PDF) |
| **UI/UX** | Light mode, accessibility improvements, onboarding tour, achievement system |

---

## 🐛 Known Issues

- Deepgram may fail with network timeouts; Chrome STT is auto-fallback
- Photo capture requires good lighting for accurate body language analysis
- Browser Web Speech API (Chrome) has lower accuracy than Deepgram

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👥 Authors

- **Umesh Yadav** - [GitHub](https://github.com/Umesh49)
- **Neha Yadav** - [GitHub](https://github.com/Neha020401)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

<p align="center">Made with ❤️ for job seekers everywhere</p>
