"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Send, ShieldCheck, Video } from 'lucide-react';
import dynamic from 'next/dynamic';

const FaceDetectionCamera = dynamic(() => import('@/components/FaceDetectionCamera'), { ssr: false });

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000") + "/api";

const SurveyPage = () => {
    const { id } = useParams();
    const router = useRouter();
    const [submissionId, setSubmissionId] = useState<number | null>(null);
    const [survey, setSurvey] = useState<any>(null);
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<any[]>([]);
    const [snapshotsMap, setSnapshotsMap] = useState<Record<number, Blob>>({});
    const [isFaceValid, setIsFaceValid] = useState(false);
    const [faceScore, setFaceScore] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);

    const cameraRef = useRef<any>(null);

    useEffect(() => {
        const fetchSurvey = async () => {
            try {
                const res = await axios.get(`${API_BASE}/surveys/${id}`);
                if (!res.data || !res.data.questions) {
                    throw new Error("Invalid survey data received");
                }
                setSurvey(res.data);
            } catch (err: any) {
                console.error("Survey error:", err);
                setError(err.response?.data?.detail || err.message || "Could not load survey");
            }
        };
        if (id) fetchSurvey();
    }, [id]);

    const handleFaceStatus = (status: 'none' | 'single' | 'multiple', score: number) => {
        setIsFaceValid(status === 'single');
        setFaceScore(score);
    };

    const startRecording = () => {
        const videoElement = document.querySelector('video');
        if (videoElement && (videoElement.srcObject as MediaStream)) {
            const stream = videoElement.srcObject as MediaStream;
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) setRecordedChunks(prev => [...prev, e.data]);
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setIsRecording(false);
        }
    };

    const handleNext = async () => {
        if (!isFaceValid) return;

        if (step === 0) {
            try {
                const res = await axios.post(`${API_BASE}/surveys/${id}/start`);
                setSubmissionId(res.data.submission_id);
                if (!isRecording) startRecording();
            } catch (err: any) {
                alert("Failed to initialize secure session. Please try again.");
                return;
            }
        }

        if (step < (survey?.questions?.length || 0)) {
            setStep(prev => prev + 1);
        }
    };

    const submitAnswer = async (answer: boolean) => {
        const currentQuestion = survey.questions[step - 1];

        // Capture snapshot
        if (cameraRef.current) {
            const blob = await cameraRef.current.captureSnapshot();
            if (blob) {
                setSnapshotsMap(prev => ({ ...prev, [currentQuestion.id]: blob }));
            }
        }

        const newAnswer = {
            question_id: currentQuestion.id,
            answer,
            face_detected: isFaceValid,
            face_score: faceScore
        };

        const updatedAnswers = [...answers, newAnswer];
        setAnswers(updatedAnswers);

        if (step === (survey?.questions?.length || 0)) {
            handleSubmit(updatedAnswers);
        } else {
            setStep(prev => prev + 1);
        }
    };

    const handleSubmit = async (finalAnswers: any[]) => {
        stopRecording();
        setIsSubmitting(true);

        // Wait for recording to finish processing
        setTimeout(async () => {
            try {
                if (!submissionId) throw new Error("No active session");

                // 1. Save Answers
                await axios.post(`${API_BASE}/submissions/${submissionId}/answers`, finalAnswers);

                // 2. Upload Media
                const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
                const formData = new FormData();
                formData.append("video", videoBlob, "survey_video.webm");
                Object.entries(snapshotsMap).forEach(([qId, blob]) => {
                    formData.append("snapshots", blob, `q_${qId}.jpg`);
                });
                await axios.post(`${API_BASE}/submissions/${submissionId}/media`, formData);

                // 3. Complete
                await axios.post(`${API_BASE}/submissions/${submissionId}/complete`);

                setStep(-1); // Success screen
            } catch (err) {
                console.error("Submission failed", err);
                setIsSubmitting(false);
                alert("Critical failure during transmission. Please contact support.");
            }
        }, 1000);
    };



    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <h2 className="text-xl font-bold text-white">Error Loading Survey</h2>
            <p className="text-zinc-500">{error}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary">Try Again</button>
        </div>
    );

    if (!survey || !survey.questions) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-zinc-500">Loading Secure Survey Environment...</p>
        </div>
    );

    if (step === -1) return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto mt-20 p-8 glass text-center"
        >
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Survey Submitted Successfully!</h1>
            <p className="text-zinc-400 mb-8">Your responses and face validation metrics have been recorded securely.</p>
            <button onClick={() => router.push('/')} className="btn-primary w-full">Return Home</button>
        </motion.div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Progress Bar */}
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(step / ((survey?.questions?.length || 1) + 1)) * 100}%` }}
                    className="h-full bg-blue-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Camera Feed */}
                <div className="sticky top-24">
                    <FaceDetectionCamera ref={cameraRef} onFaceStatusChange={handleFaceStatus} isRecording={isRecording} />
                    {!isFaceValid && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p>Face detection required to proceed. Please ensure your face is clearly visible and centered.</p>
                        </motion.div>
                    )}
                </div>

                {/* Question Step */}
                <div className="glass p-8 min-h-[400px] flex flex-col">
                    <AnimatePresence mode="wait">
                        {step === 0 ? (
                            <motion.div
                                key="intro"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center gap-3 text-blue-400">
                                    <Video className="w-6 h-6" />
                                    <span className="font-bold uppercase tracking-widest text-sm">Security Check</span>
                                </div>
                                <h2 className="text-3xl font-bold">{survey.title}</h2>
                                <p className="text-zinc-400 leading-relaxed">
                                    This survey uses face detection to ensure data integrity.
                                    Your video will be recorded only for verification purposes.
                                    No personal identity data is stored.
                                </p>
                                <button
                                    disabled={!isFaceValid}
                                    onClick={handleNext}
                                    className="btn-primary w-full group"
                                >
                                    Start Survey
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8 flex-1 flex flex-col justify-center"
                            >
                                <div className="space-y-2">
                                    <span className="text-blue-500 font-bold">Question {step} of {survey?.questions?.length || 0}</span>
                                    <h2 className="text-2xl font-semibold leading-tight">
                                        {survey?.questions?.[step - 1]?.question_text || "Loading question..."}
                                    </h2>
                                </div>

                                <div className="grid grid-cols-2 gap-4 relative">
                                    <button
                                        disabled={!isFaceValid || isSubmitting}
                                        onClick={() => submitAnswer(true)}
                                        className={`p-6 rounded-2xl border transition-all font-bold text-lg flex items-center justify-center gap-2 ${isFaceValid
                                            ? 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500'
                                            : 'bg-zinc-900 border-white/5 opacity-50 cursor-not-allowed'
                                            }`}
                                    >
                                        {isFaceValid && <CheckCircle className="w-5 h-5 text-green-500" />}
                                        YES
                                    </button>
                                    <button
                                        disabled={!isFaceValid || isSubmitting}
                                        onClick={() => submitAnswer(false)}
                                        className={`p-6 rounded-2xl border transition-all font-bold text-lg flex items-center justify-center gap-2 ${isFaceValid
                                            ? 'bg-zinc-800 border-white/5 hover:bg-zinc-700 hover:border-white/20'
                                            : 'bg-zinc-900 border-white/5 opacity-50 cursor-not-allowed'
                                            }`}
                                    >
                                        {isFaceValid && <CheckCircle className="w-5 h-5 text-green-500" />}
                                        NO
                                    </button>
                                    {!isFaceValid && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-2xl pointer-events-none">
                                            <span className="bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full border border-red-500/30">
                                                FACE REQUIRED
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {isSubmitting && (
                                    <div className="flex items-center justify-center gap-3 text-zinc-500 mt-4">
                                        <Send className="w-5 h-5 animate-pulse" />
                                        <span>Transmitting secure data...</span>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default SurveyPage;
