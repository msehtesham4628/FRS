"use client";

if (typeof window !== "undefined") {
    if (!window.TextEncoder) {
        (window as any).TextEncoder = class {
            encode(s: string) {
                const arr = new Uint8Array(s.length);
                for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
                return arr;
            }
        };
    }
}

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    onFaceStatusChange: (status: 'none' | 'single' | 'multiple', score: number) => void;
    isRecording: boolean;
}

export interface FaceDetectionCameraHandle {
    captureSnapshot: () => Promise<Blob | null>;
}

const FaceDetectionCamera = forwardRef<FaceDetectionCameraHandle, Props>(({ onFaceStatusChange, isRecording }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [faceStatus, setFaceStatus] = useState<'none' | 'single' | 'multiple'>('none');

    useImperativeHandle(ref, () => ({
        captureSnapshot: async () => {
            if (!videoRef.current) return null;
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.drawImage(video, 0, 0);
            return new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
            });
        }
    }));

    useEffect(() => {
        const loadModels = async () => {
            try {
                // Using external URL for now as requested for reliability
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
            } catch (err) {
                console.error("Error loading models", err);
                setError("Failed to load face detection models");
            }
        };
        loadModels();
    }, []);

    useEffect(() => {
        if (modelsLoaded && videoRef.current) {
            startVideo();
        }
    }, [modelsLoaded]);

    const startVideo = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera", err);
            setError("Camera access denied");
        }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (modelsLoaded && videoRef.current) {
            interval = setInterval(async () => {
                if (videoRef.current && videoRef.current.readyState === 4) {
                    const detections = await faceapi.detectAllFaces(
                        videoRef.current,
                        new faceapi.TinyFaceDetectorOptions()
                    );

                    let status: 'none' | 'single' | 'multiple' = 'none';
                    let score = 0;

                    if (detections.length === 1) {
                        status = 'single';
                        score = Math.round(detections[0].score * 100);
                    } else if (detections.length > 1) {
                        status = 'multiple';
                    }

                    setFaceStatus(status);
                    onFaceStatusChange(status, score);

                    // Draw detections briefly
                    if (canvasRef.current) {
                        const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
                        const resized = faceapi.resizeResults(detections, dims);
                        faceapi.draw.drawDetections(canvasRef.current, resized);
                    }
                }
            }, 200);
        }
        return () => clearInterval(interval);
    }, [modelsLoaded, onFaceStatusChange]);

    return (
        <div className="relative w-full max-w-2xl mx-auto overflow-hidden rounded-2xl glass aspect-video group">
            {!modelsLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                    <p className="text-zinc-400">Initializing Core...</p>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/40 z-20 backdrop-blur-sm">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
                    <p className="text-white font-medium">{error}</p>
                </div>
            )}

            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

            {/* Recording Indicator */}
            {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full animate-pulse z-10 shadow-lg shadow-red-600/20">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    <span className="text-xs font-bold uppercase tracking-wider">REC</span>
                </div>
            )}

            {/* Status Overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 z-10 transition-all group-hover:bg-black/60">
                <AnimatePresence mode="wait">
                    {faceStatus === 'single' ? (
                        <motion.div
                            key="single"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex items-center gap-2 text-green-400"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                            >
                                <CheckCircle2 className="w-4 h-4" />
                            </motion.div>
                            <span className="text-xs font-bold uppercase tracking-wider">Ready</span>
                        </motion.div>
                    ) : faceStatus === 'multiple' ? (
                        <motion.div
                            key="multiple"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-2 text-yellow-400"
                        >
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">Multiple Faces</span>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="none"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-2 text-zinc-400"
                        >
                            <Camera className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">Detecting Face...</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 overflow-hidden">
                <motion.div
                    animate={{ x: isRecording ? ['-100%', '100%'] : '-100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full bg-blue-500"
                />
            </div>
        </div>
    );
});

export default FaceDetectionCamera;

