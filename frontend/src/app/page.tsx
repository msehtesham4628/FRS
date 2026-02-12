"use client";

import { ArrowRight, Shield, Video, Zap, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-12">
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold uppercase tracking-widest mb-4"
        >
          <Zap className="w-4 h-4" />
          Next-Gen Survey Tech
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-6xl md:text-8xl font-black gradient-text tracking-tighter"
        >
          Secure Video <br /> Intelligence.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-zinc-500 text-lg md:text-xl max-w-2xl mx-auto"
        >
          The first privacy-conscious video survey platform with real-time face validation and automated metadata intelligence.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col sm:flex-row gap-6 w-full max-w-md"
      >
        <a href="/admin" className="btn-primary flex-1 py-4">
          Admin Dashboard
          <ArrowRight className="w-5 h-5" />
        </a>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mt-20"
      >
        {[
          { icon: <Shield className="w-6 h-6 text-emerald-500" />, title: "Privacy First", desc: "No personal identifiers collected. Only metadata for system validation." },
          { icon: <Activity className="w-6 h-6 text-blue-500" />, title: "Face Detection", desc: "Real-time AI monitoring ensures survey integrity and user presence." },
          { icon: <Video className="w-6 h-6 text-rose-500" />, title: "Video Proof", desc: "Full survey session recording for comprehensive analysis and security." }
        ].map((feat, idx) => (
          <div key={idx} className="glass p-8 text-left space-y-4 hover:border-white/20 transition-all group">
            <div className="p-3 bg-zinc-900 rounded-2xl w-fit group-hover:scale-110 transition-transform">
              {feat.icon}
            </div>
            <h3 className="text-xl font-bold">{feat.title}</h3>
            <p className="text-zinc-500 leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

