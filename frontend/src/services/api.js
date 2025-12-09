import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Resume endpoints
export const getResumes = async () => {
    const response = await api.get('/resumes/');
    return response.data;
};

export const uploadResume = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/resumes/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const deleteResume = async (resumeId) => {
    const response = await api.delete(`/resumes/${resumeId}/`);
    return response.data;
};

export const getATSScore = async (resumeId, jobDescription) => {
    const response = await api.post(`/resumes/${resumeId}/ats_score/`, {
        job_description: jobDescription
    });
    return response.data;
};

// Interview endpoints
const MIN_RESUME_ID_LENGTH = 10; // UUIDs or valid IDs are longer than 10 chars

export const createInterview = async (resumeId, position, difficulty, experienceLevel = '0-2 years') => {
    const payload = { position, difficulty, experience_level: experienceLevel };
    if (resumeId && resumeId.length > MIN_RESUME_ID_LENGTH) payload.resume = resumeId; const response = await api.post('/interviews/', payload);
    return response.data;
};

export const startInterview = async (sessionId) => {
    const response = await api.post(`/interviews/${sessionId}/start_interview/`);
    return response.data;
};

export const getPreInterviewTips = async (sessionId) => {
    const response = await api.get(`/interviews/${sessionId}/pre_interview_tips/`);
    return response.data;
};

export const clarifyQuestion = async (sessionId, questionId) => {
    const response = await api.post(`/interviews/${sessionId}/clarify_question/`, { question_id: questionId });
    return response.data;
};

export const submitResponse = async (sessionId, questionId, transcript, audioBlob, fluencyMetrics, issueLog) => {
    const formData = new FormData();
    formData.append('question_id', questionId);
    formData.append('transcript', transcript);
    formData.append('fluency_metrics', JSON.stringify(fluencyMetrics));
    if (audioBlob) formData.append('audio_file', audioBlob, 'response.wav');
    if (issueLog) formData.append('metrics_timeline', JSON.stringify(issueLog));

    const response = await api.post(`/interviews/${sessionId}/submit_response/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const getInterviewResult = async (sessionId) => {
    const response = await api.get(`/interviews/${sessionId}/get_result/`);
    return response.data;
};

export const getInterviewHistory = async () => {
    const response = await api.get('/interviews/');
    return response.data;
};

export const deleteSession = async (sessionId) => {
    await api.delete(`/interviews/${sessionId}/delete_session/`);
};

export const getStudentProgress = async () => {
    const response = await api.get('/interviews/student_progress/');
    return response.data;
};

// Feature endpoints
export const getResources = async () => {
    const response = await api.get('/interviews/resources/');
    return response.data;
};

export const getDailyTip = async () => {
    const response = await api.get('/interviews/daily_tip/');
    return response.data;
};

export const getDetailedAnalytics = async () => {
    const response = await api.get('/interviews/detailed_analytics/');
    return response.data;
};

export const getCompanyPrep = async (company = '') => {
    const params = company ? `?company=${company}` : '';
    const response = await api.get(`/interviews/company_prep/${params}`);
    return response.data;
};

export const getAnswerTemplates = async () => {
    const response = await api.get('/interviews/answer_templates/');
    return response.data;
};

export const getQuickPractice = async (category = '', difficulty = '') => {
    const response = await api.post('/interviews/quick_practice/', { category, difficulty });
    return response.data;
};

// Privacy endpoints
export const deleteAllData = async () => {
    const response = await api.delete('/students/delete_all_data/');
    return response.data;
};

// Body Language Analysis
export const analyzeBodyLanguagePhotos = async (sessionId, photos) => {
    const response = await api.post(`/interviews/${sessionId}/analyze_body_language/`, {
        photos: photos
    });
    return response.data;
};

export default api;

