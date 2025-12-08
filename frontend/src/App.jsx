import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import InterviewSetup from './pages/InterviewSetup';
import Interview from './pages/Interview';
import Result from './pages/Result';
import Analytics from './pages/Analytics';
import Resources from './pages/Resources';
import ATSScanner from './pages/ATSScanner';
import CompanyPrep from './pages/CompanyPrep';
import AnswerTemplates from './pages/AnswerTemplates';
import QuickPractice from './pages/QuickPractice';
import Privacy from './pages/Privacy';
import InterviewGuide from './pages/InterviewGuide';
import Header from './components/Header';
import Footer from './components/Footer';
import AnimatedBackground from './components/AnimatedBackground';
import ScrollToTop from './components/ScrollToTop';

const Layout = ({ children }) => {
  const location = useLocation();
  const fullscreenPages = ['/interview-session/'];
  const isFullscreen = fullscreenPages.some(path => location.pathname.includes(path));
  const isHome = location.pathname === '/';

  if (isFullscreen) {
    return <>{children}</>;
  }

  return (
    <>
      <AnimatedBackground variant={isHome ? 'hero' : 'default'} />
      <Header />
      <main className="pt-24 min-h-screen">
        {children}
      </main>
      <Footer />
    </>
  );
};

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen text-white font-sans selection:bg-primary-500/30">
        <Routes>
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/interview/:sessionId" element={<Layout><InterviewSetup /></Layout>} />
          <Route path="/interview-session/:sessionId" element={<Interview />} />
          <Route path="/result/:sessionId" element={<Layout><Result /></Layout>} />
          <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
          <Route path="/resources" element={<Layout><Resources /></Layout>} />
          <Route path="/ats-scanner" element={<Layout><ATSScanner /></Layout>} />
          <Route path="/company-prep" element={<Layout><CompanyPrep /></Layout>} />
          <Route path="/templates" element={<Layout><AnswerTemplates /></Layout>} />
          <Route path="/quick-practice" element={<Layout><QuickPractice /></Layout>} />
          <Route path="/privacy" element={<Layout><Privacy /></Layout>} />
          <Route path="/interview-guide" element={<Layout><InterviewGuide /></Layout>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
