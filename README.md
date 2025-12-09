# 🎯 InterviewIQ - AI Interview Coach

An intelligent, AI-powered mock interview platform designed to help job seekers practice and improve their interview skills through realistic simulations, real-time feedback, and comprehensive performance analytics.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Django](https://img.shields.io/badge/django-4.2-green)
![React](https://img.shields.io/badge/react-19-61dafb)
![Vite](https://img.shields.io/badge/vite-5-646CFF)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-4-06B6D4)

---

## 🌟 What Makes This Special

- **No Login Required** - Start practicing immediately without account creation
- **Real-Time Voice Analysis** - Deepgram-powered speech-to-text with Indian English support
- **Body Language Tracking** - MediaPipe-powered eye contact and posture monitoring
- **Multi-AI Provider System** - Automatic failover across Groq, Cerebras, Gemini, and OpenRouter
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **Session Persistence** - Resume interrupted interviews from where you left off

---

## ✨ Features

### 🎤 AI-Powered Mock Interviews
- **Smart Question Generation**: Dynamic, position-specific questions tailored to your resume
- **Progressive Difficulty**: Questions adapt based on experience level (0-2, 3-5, 5-10, 10+ years)
- **Multiple Categories**: Technical, Behavioral, HR, and Situational questions
- **Follow-up Questions**: Contextual follow-ups based on your previous answers
- **Session Persistence**: Refresh-safe interviews with automatic progress restoration

### 🗣️ Real-Time Voice Analysis
- **Deepgram Speech-to-Text**: Real-time transcription with Indian English (`en-IN`) support
- **Reactive Audio Visualization**: Wave animation responds to actual voice input
- **Fluency Metrics**: Tracks filler words, pauses, speech pace, and vocabulary diversity
- **Grammar Checking**: Identifies grammatical errors with suggestions using LanguageTool
- **STAR Method Detection**: Analyzes if responses follow the Situation-Task-Action-Result structure

### 📹 Body Language Tracking
- **Eye Contact Monitoring**: Tracks gaze patterns using MediaPipe Holistic
- **Posture Analysis**: Evaluates body posture throughout the interview
- **Real-time Feedback**: Visual indicators during the interview

### 🎨 Modern UI/UX
- **Framer Motion Animations**: Smooth entrance/exit animations throughout
- **Glassmorphic Design**: Modern card styles with backdrop blur
- **Dark Mode First**: Professional zinc-based dark theme
- **Responsive Layout**: Optimized for all screen sizes
- **Live Transcript Panel**: Real-time display of your spoken responses

### 📊 Comprehensive Analytics
- **Performance Dashboard**: Track your progress over time
- **Category Breakdown**: Scores for Communication, Content Quality, and Confidence
- **Detailed Feedback**: AI-generated insights with specific improvement suggestions
- **Historical Trends**: View performance trends across all sessions

### 📄 ATS Scanner
- **Resume Analysis**: Check how well your resume matches job descriptions
- **Keyword Matching**: Identify matching and missing keywords
- **Score Calculation**: Get an ATS compatibility score (0-100)
- **Actionable Suggestions**: Specific tips to improve your resume

### 🎓 Learning Resources
- **Interview Guides**: Comprehensive tips for different interview stages
- **Answer Templates**: Fill-in-the-blank templates for common questions (STAR method)
- **Company Prep**: Company-specific interview preparation and common questions
- **Quick Practice**: 3-question drill sessions for rapid skill building

### 🔒 Privacy Controls
- **Data Transparency**: Clear information about what data is stored
- **Hard Delete**: Permanently delete all your data (resumes, interviews, responses)
- **No Login Required**: Use the app without creating an account

### 🤖 Multi-Provider AI System
| Provider | Purpose | Rate Limit |
|----------|---------|------------|
| Groq | Primary - Fast inference | Free tier |
| Cerebras | Secondary | 14,400 req/day |
| Google Gemini | Fallback (dual API key support) | Varies |
| OpenRouter | Access to multiple open-source models | Varies |

**Automatic Failover**: Seamless switching between providers when one fails.

### 🔐 Security Features
- **Rate Limiting**: 100 req/hour (anonymous), 1000 req/hour (authenticated)
- **Input Sanitization**: HTML stripping, entity escaping, length limits
- **File Validation**: MIME type checking, magic byte validation, size limits
- **Custom Exception Handler**: Consistent error responses, no stack trace leaks
- **Standard API Responses**: `{success, message, data/errors}` format

---

## 🏗️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Django 4.2 | Web framework |
| Django REST Framework | API development |
| SQLite/PostgreSQL | Database |
| Groq/Gemini/Cerebras | AI question generation & analysis |
| LanguageTool | Grammar checking |
| PDFMiner | Resume parsing |

### Frontend
| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| Vite 5 | Build tool |
| TailwindCSS 4 | Styling |
| Framer Motion | Animations |
| GSAP | Advanced animations |
| Recharts | Data visualization |
| MediaPipe Holistic | Body language tracking |
| Deepgram SDK | Speech-to-text & text-to-speech |
| Lucide React | Icons |

---

## 📁 Project Structure

```
fair_ai_interview_app/
├── backend/
│   ├── config/                  # Django settings & configuration
│   │   ├── settings.py          # Main settings (rate limiting, etc.)
│   │   ├── urls.py              # Root URL configuration
│   │   └── wsgi.py              # WSGI entry point
│   ├── core/                    # Main application
│   │   ├── models.py            # Database models
│   │   ├── serializers.py       # Data serialization
│   │   ├── admin.py             # Django admin configuration
│   │   ├── utils.py             # Sanitization, validation, API helpers
│   │   ├── views/               # Modular ViewSets
│   │   │   ├── __init__.py
│   │   │   ├── student_views.py
│   │   │   ├── resume_views.py
│   │   │   └── interview_views.py
│   │   └── services/            # Business logic & AI
│   │       ├── __init__.py
│   │       ├── ai_service.py           # Multi-provider AI calls
│   │       ├── interview_service.py    # Question generation & analysis
│   │       ├── helper_functions.py     # STAR detection, metrics
│   │       ├── voice_service.py        # Deepgram TTS
│   │       └── analyze_body_language.py # Gemini Vision
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
│   │   │   └── AnimatedBackground.jsx
│   │   ├── pages/               # Main application pages
│   │   │   ├── Home.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Interview.jsx
│   │   │   ├── Result.jsx
│   │   │   └── Analytics.jsx
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── useDeepgram.js   # Speech-to-text
│   │   │   └── usePhotoCapture.js # Body language photos
│   │   └── services/            # API integration
│   ├── index.html
│   └── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
# Navigate to project root
cd fair_ai_interview_app

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r backend/requirements.txt

# Create .env file in project root
GROQ_API_KEY=your_key
GEMINI_API_KEY=your_key
DEEPGRAM_API_KEY=your_key
CEREBRAS_API_KEY=your_key  # Optional
OPENROUTER_API_KEY=your_key  # Optional

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

# Create .env file
VITE_DEEPGRAM_API_KEY=your_deepgram_key

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
| Interview Setup | `/interview/:id` | Configure camera, mic before interview |
| Interview | `/interview-session/:id` | Main AI interview experience |
| Results | `/result/:id` | Detailed performance analysis |
| Analytics | `/analytics` | Historical performance trends |
| ATS Scanner | `/ats-scanner` | Resume vs job description analysis |
| Resources | `/resources` | Interview guides and tips |
| Templates | `/templates` | Fill-in-the-blank answer templates |
| Company Prep | `/company-prep` | Company-specific preparation |
| Quick Practice | `/quick-practice` | 3-question drill sessions |
| Privacy | `/privacy` | Data management and deletion |

---

## 🔑 API Endpoints

### Resume Management
- `GET /api/resumes/` - List all resumes
- `POST /api/resumes/` - Upload new resume
- `DELETE /api/resumes/:id/` - Delete resume
- `POST /api/resumes/:id/ats_score/` - Get ATS score

### Interviews
- `POST /api/interviews/` - Create new interview
- `POST /api/interviews/:id/start_interview/` - Start interview
- `POST /api/interviews/:id/submit_response/` - Submit answer
- `GET /api/interviews/:id/generate_report/` - Get results

### Features
- `GET /api/interviews/student_progress/` - Dashboard stats
- `GET /api/interviews/detailed_analytics/` - Full analytics
- `GET /api/interviews/resources/` - Interview guides
- `GET /api/interviews/answer_templates/` - Answer templates
- `GET /api/interviews/company_prep/` - Company prep
- `POST /api/interviews/quick_practice/` - Quick drill

### Privacy
- `DELETE /api/students/delete_all_data/` - Hard delete all data

---

## 🚀 Future Enhancements

### 🎯 Coming Soon
- [ ] **Video Recording**: Record interview sessions for self-review
- [ ] **Multi-language Support**: Hindi, Tamil, Telugu interview support
- [ ] **Custom Question Sets**: Create and save your own question banks
- [ ] **Interview Scheduling**: Schedule practice sessions with reminders
- [ ] **Peer Practice Mode**: Practice with friends in real-time

### 🔮 Planned Features
- [ ] **AI Interviewer Avatar**: Animated 3D avatar during interviews
- [ ] **Industry-Specific Modes**: Tech, Finance, Healthcare interview styles
- [ ] **Resume Builder**: Built-in resume editor with ATS optimization
- [ ] **LinkedIn Integration**: Import profile data for personalized questions
- [ ] **Certification Prep**: Specific prep for AWS, Google, Azure certifications

### 🛠️ Technical Improvements
- [ ] **User Authentication**: Optional login for progress sync across devices
- [ ] **PWA Support**: Install as mobile app
- [ ] **Offline Mode**: Practice without internet using cached questions
- [ ] **WebRTC Integration**: Better audio/video quality
- [ ] **Analytics Export**: Download performance reports as PDF

### 🎨 UI/UX Enhancements
- [ ] **Theme Customization**: Light mode, custom accent colors
- [ ] **Accessibility**: Screen reader support, keyboard navigation
- [ ] **Onboarding Tour**: Guided walkthrough for new users
- [ ] **Achievement System**: Badges and milestones for motivation

---

## 🐛 Known Issues

- Transcript may be delayed on slow network connections
- MediaPipe requires good lighting for accurate tracking
- Browser Web Speech API fallback has lower accuracy than Deepgram

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
- **Neha Yadav** - [GitHub](https://github.com/nehayadav)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

<p align="center">Made with ❤️ for job seekers everywhere</p>