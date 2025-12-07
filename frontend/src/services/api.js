import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// No authentication needed for MVP - using anonymous user

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

export const createInterview = async (resumeId, position, difficulty, experienceLevel = '0-2 years') => {
    const payload = {
        position,
        difficulty,
        experience_level: experienceLevel,
    };

    // Only include resume if it's a valid UUID
    if (resumeId && resumeId.length > 10) {
        payload.resume = resumeId;
    }

    const response = await api.post('/interviews/', payload);
    return response.data;
};

export const startInterview = async (sessionId) => {
    const response = await api.post(`/interviews/${sessionId}/start_interview/`);
    return response.data;
};

export const getStudentProgress = async () => {
    const response = await api.get('/interviews/student_progress/');
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

export const deleteSession = async (sessionId) => {
    await api.delete(`/interviews/${sessionId}/delete_session/`);
};

export const submitResponse = async (sessionId, questionId, transcript, audioBlob, fluencyMetrics, issueLog) => {
    const formData = new FormData();
    formData.append('question_id', questionId);
    formData.append('transcript', transcript);
    formData.append('fluency_metrics', JSON.stringify(fluencyMetrics));

    if (audioBlob) {
        formData.append('audio_file', audioBlob, 'response.wav');
    }

    if (issueLog) {
        formData.append('metrics_timeline', JSON.stringify(issueLog));
    }

    const response = await api.post(`/interviews/${sessionId}/submit_response/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const getInterviewResult = async (sessionId) => {
    const response = await api.get(`/interviews/${sessionId}/get_result/`);
    return response.data;
};

// Get user's interview history (completed sessions)
export const getInterviewHistory = async () => {
    const response = await api.get('/interviews/');
    return response.data;
};

export default api;
