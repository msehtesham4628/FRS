"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Check, Play, Layout, Trash2, Globe, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000") + "/api";

const AdminPage = () => {
    const [surveys, setSurveys] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newSurveyTitle, setNewSurveyTitle] = useState("");
    const [questions, setQuestions] = useState<string[]>(["", "", "", "", ""]);
    const [isCreating, setIsCreating] = useState(false);
    const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

    useEffect(() => {
        fetchSurveys();
    }, []);

    const fetchSurveys = async () => {
        try {
            const res = await axios.get(`${API_BASE}/surveys/`);
            setSurveys(res.data);
        } catch (err) {
            console.error("Failed to fetch surveys", err);
        }
    };

    const testConnection = async () => {
        setConnStatus('testing');
        try {
            const res = await axios.get(`${API_BASE}/health`);
            if (res.data?.status === 'healthy') {
                setConnStatus('ok');
                setTimeout(() => setConnStatus('idle'), 3000);
            } else {
                setConnStatus('fail');
            }
        } catch (err: any) {
            console.error("Conn test failed:", err);
            setConnStatus('fail');
            alert(`Connection failed: ${err.message}. \n\nCheck if backend is running on ${API_BASE}`);
        }
    };

    const handleCreate = async () => {
        if (!newSurveyTitle) {
            alert("Please enter a survey title.");
            return;
        }
        if (questions.some(q => !q.trim())) {
            alert("Please fill in all 5 questions before publishing.");
            return;
        }

        setIsCreating(true);
        try {
            await axios.post(`${API_BASE}/surveys/`, {
                title: newSurveyTitle,
                is_active: true,
                questions: questions.map((q, i) => ({ question_text: q, order: i + 1 }))
            });
            setShowCreate(false);
            setNewSurveyTitle("");
            setQuestions(["", "", "", "", ""]);
            fetchSurveys();
        } catch (err: any) {
            console.error(err);
            alert(`Failed to publish survey: ${err.response?.data?.detail || err.message}`);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this survey?")) return;
        try {
            await axios.delete(`${API_BASE}/surveys/${id}`);
            fetchSurveys();
        } catch (err: any) {
            console.error("Failed to delete survey", err);
            alert(`Failed to delete survey: ${err.message}`);
        }
    };

    const handleExport = async (subId: number) => {
        try {
            const res = await axios.get(`${API_BASE}/submissions/${subId}/export`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `submission_${subId}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err: any) {
            console.error("Export failed", err);
            alert("Failed to export submission data.");
        }
    };

    const copyLink = (id: number) => {
        const url = `${window.location.origin}/survey/${id}`;
        navigator.clipboard.writeText(url);
        alert("Public URL copied to clipboard!");
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-zinc-400">Manage and create video surveys</p>
                        <button
                            onClick={testConnection}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${connStatus === 'ok' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                                connStatus === 'fail' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                                    'bg-zinc-800 text-zinc-400 border-white/5 hover:bg-zinc-700'
                                }`}
                        >
                            {connStatus === 'testing' ? 'TESTING...' :
                                connStatus === 'ok' ? 'CONNECTION OK' :
                                    connStatus === 'fail' ? 'CONNECTION FAILED' :
                                        'TEST CONNECTION'}
                        </button>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="btn-primary"
                >
                    <Plus className="w-5 h-5" />
                    Create New Survey
                </button>
            </div>

            <AnimatePresence>
                {showCreate && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="glass p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Create New Survey</h2>
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
                                    {questions.filter(q => q.trim()).length} / 5 Questions Filled
                                </span>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Survey Title</label>
                                <input
                                    type="text"
                                    value={newSurveyTitle}
                                    onChange={(e) => setNewSurveyTitle(e.target.value)}
                                    placeholder="e.g. Customer Satisfaction 2024"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Questions (Exactly 5)</label>
                                {questions.map((q, idx) => (
                                    <div key={idx} className="flex gap-4 items-center">
                                        <span className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                        <input
                                            type="text"
                                            value={q}
                                            onChange={(e) => {
                                                const newQ = [...questions];
                                                newQ[idx] = e.target.value;
                                                setQuestions(newQ);
                                            }}
                                            placeholder={`Enter question ${idx + 1}`}
                                            className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    disabled={isCreating}
                                    onClick={handleCreate}
                                    className="btn-primary flex-1"
                                >
                                    {isCreating ? 'Publishing...' : 'Publish Survey'}
                                </button>
                                <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {surveys.map(s => (
                    <motion.div
                        layout
                        key={s.id}
                        className="glass p-6 space-y-4 group"
                    >
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Layout className="w-5 h-5 text-blue-500" />
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${s.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                {s.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <button
                                onClick={() => handleDelete(s.id)}
                                className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors"
                                title="Delete Survey"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <h3 className="text-xl font-bold leading-tight">{s.title}</h3>
                        <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                            <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">
                                {s.questions.length} questions
                            </span>
                            <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">
                                {s.submissions?.length || 0} submissions
                            </span>
                        </div>

                        {s.submissions?.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Latest Submissions</p>
                                {s.submissions.slice(-3).reverse().map((sub: any) => (
                                    <div key={sub.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5 group">
                                        <div className="text-[10px] text-zinc-400">
                                            {new Date(sub.timestamp).toLocaleDateString()} • {Math.round(sub.overall_score)}% score
                                        </div>
                                        <button
                                            onClick={() => handleExport(sub.id)}
                                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            EXPORT ZIP
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                            <button onClick={() => copyLink(s.id)} className="text-sm text-zinc-400 hover:text-white flex items-center gap-2 transition-colors">
                                <Copy className="w-4 h-4" />
                                Copy Link
                            </button>
                            <a href={`/survey/${s.id}`} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors ml-auto">
                                <Play className="w-4 h-4" />
                                Open
                            </a>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default AdminPage;
