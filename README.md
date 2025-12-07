# 🎯 AI Interview Coach

An intelligent, AI-powered mock interview platform designed to help job seekers practice and improve their interview skills through realistic simulations, real-time feedback, and comprehensive performance analytics.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Django](https://img.shields.io/badge/django-4.2-green)
![React](https://img.shields.io/badge/react-19-61dafb)

## ✨ Features

### 🎤 Realistic Interview Simulation
- **AI-Generated Questions**: Dynamic, position-specific questions tailored to your resume and experience level
- **Progressive Difficulty**: Questions start easy and gradually increase in difficulty to build confidence
- **Multiple Categories**: Mix of Technical, Behavioral, and Situational questions
- **Follow-up Questions**: AI generates contextual follow-ups based on your previous answers

### 🗣️ Real-Time Voice Analysis
- **Speech-to-Text**: Real-time transcription using Deepgram API
- **Fluency Metrics**: Tracks filler words, pauses, speech pace, and vocabulary diversity
- **Grammar Checking**: Identifies grammatical errors with suggestions using LanguageTool
- **STAR Method Detection**: Analyzes if responses follow the Situation-Task-Action-Result structure

### 📹 Body Language Tracking
- **Eye Contact Monitoring**: Tracks gaze patterns using MediaPipe Holistic
- **Posture Analysis**: Evaluates body posture throughout the interview
- **Gesture Detection**: Identifies excessive fidgeting or nervous movements
- **Real-time Feedback**: Visual indicators during the interview

### 🤖 Multi-Provider AI System
- **Groq** (Primary - Fast inference, free tier)
- **Cerebras** (Secondary - 14,400 req/day)
- **Google Gemini** (Fallback with dual API key support)
- **OpenRouter** (Access to multiple open-source models)
- **Automatic Failover**: Seamless switching between providers

### 📊 Comprehensive Analytics
- **Overall Performance Score**: Weighted combination of all metrics
- **Category Breakdown**: Separate scores for Communication, Content Quality, and Confidence
- **Detailed Feedback**: AI-generated insights with specific improvement suggestions
- **Progress Tracking**: Historical performance trends via dashboard

### 🎓 Beginner-Friendly Features
- **Pre-Interview Tips**: Anxiety-reducing preparation guide
- **Question Hints**: Clarification available without revealing answers
- **Encouraging Feedback**: Positive reinforcement throughout the interview
- **Actionable Improvement Tips**: Specific, practical advice for each response

## 🏗️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Django 4.2 | Web framework |
| Django REST Framework | API development |
| PostgreSQL/SQLite | Database |
| Google Generative AI | Question generation & analysis |
| LanguageTool | Grammar checking |
| PDFMiner | Resume parsing |

### Frontend
| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| Vite | Build tool |
| TailwindCSS 4 | Styling |
| Axios | HTTP client |
| Recharts | Data visualization |
| MediaPipe Holistic | Body language tracking |
| Deepgram SDK | Speech-to-text |
| Lucide React | Icons |

## 📁 Project Structure

```
fair_ai_interview_app/
├── backend/
│   ├── config/              # Django settings & configuration
│   │   ├── settings.py      # Main settings
│   │   ├── urls.py          # Root URL configuration
│   │   └── wsgi.py          # WSGI entry point
│   ├── core/                # Main application
│   │   ├── models.py        # Database models
│   │   ├── views.py         # API endpoints (ViewSets)
│   │   ├── services.py      # Business logic & AI integration
│   │   ├── serializers.py   # Data serialization
│   │   └── urls.py          # API routes
│   ├── media/               # Uploaded files (resumes, recordings)
│   ├── requirements.txt     # Python dependencies
│   └── manage.py            # Django CLI
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Main application pages
│   │   │   ├── Home.jsx           # Landing page
│   │   │   ├── InterviewSetup.jsx # Interview configuration
│   │   │   ├── Interview.jsx      # Main interview interface
│   │   │   ├── Result.jsx         # Performance results
│   │   │   └── Dashboard.jsx      # Historical analytics
│   │   ├── App.jsx          # Root component with routing
│   │   └── index.css        # Global styles
│   ├── public/              # Static assets
│   ├── package.json         # Node dependencies
│   └── vite.config.js       # Vite configuration
│
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL (optional, SQLite works for development)

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Umesh49/ai-interview.git
   cd ai-interview
   ```

2. **Create virtual environment**
   ```bash
   cd backend
   python -m venv .venv
   
   # Windows
   .venv\Scripts\activate
   
   # macOS/Linux
   source .venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   
   Create a `.env` file in the `backend/` directory:
   ```env
   # Required
   GEMINI_API_KEY=your_gemini_api_key
   SECRET_KEY=your_django_secret_key
   
   # Optional (enables additional AI providers)
   GROQ_API_KEY=your_groq_api_key
   CEREBRAS_API_KEY=your_cerebras_api_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   
   # Development
   DEBUG=True
   ```

5. **Run migrations**
   ```bash
   python manage.py migrate
   ```

6. **Start the server**
   ```bash
   python manage.py runserver
   ```
   Backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_DEEPGRAM_API_KEY=your_deepgram_api_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   Frontend will be available at `http://localhost:5173`

## 📖 API Documentation

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/resumes/` | Upload and parse resume |
| `POST` | `/api/sessions/` | Create interview session |
| `POST` | `/api/sessions/{id}/pre_interview_tips/` | Get preparation tips |
| `POST` | `/api/sessions/{id}/start_interview/` | Generate questions & start |
| `POST` | `/api/sessions/{id}/submit_response/` | Submit answer with metrics |
| `POST` | `/api/sessions/{id}/clarify_question/` | Get hint for question |
| `GET` | `/api/sessions/{id}/get_result/` | Get comprehensive report |
| `GET` | `/api/sessions/history/` | Get session history |
| `GET` | `/api/sessions/progress_data/` | Get progress analytics |

### Interview Flow

```
1. Upload Resume (optional) → POST /api/resumes/
2. Create Session → POST /api/sessions/
3. Get Tips → POST /api/sessions/{id}/pre_interview_tips/
4. Start Interview → POST /api/sessions/{id}/start_interview/
5. For each question:
   └── Submit Response → POST /api/sessions/{id}/submit_response/
6. Get Results → GET /api/sessions/{id}/get_result/
```

## 🔧 Configuration

### AI Provider Priority

The system automatically selects the best available AI provider:

1. **Groq** - Fastest response times (if API key provided)
2. **Cerebras** - High daily limits (14,400 req/day)
3. **Gemini/OpenRouter** - Race for best response
4. **Fallback** - Rule-based responses if all AI fails

### Customization

- **Difficulty Levels**: Easy, Medium, Hard
- **Experience Levels**: 0-2 years, 2-5 years, 5+ years
- **Question Categories**: Intro, Technical, Behavioral, Closing

## 🧪 Testing

### Backend Tests
```bash
cd backend
python manage.py test core
```

### Frontend Tests
```bash
cd frontend
npm run lint
```

## 📈 Roadmap

- [ ] User authentication system
- [ ] Video recording and playback
- [ ] Interview scheduling
- [ ] Peer review system
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Company-specific question banks

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Umesh**
- GitHub: [@Umesh49](https://github.com/Umesh49)

## 🙏 Acknowledgments

- Google Generative AI for powerful language models
- Deepgram for accurate speech-to-text
- MediaPipe team for body tracking solutions
- The open-source community

---

<p align="center">
  Made with ❤️ for job seekers everywhere
</p>
