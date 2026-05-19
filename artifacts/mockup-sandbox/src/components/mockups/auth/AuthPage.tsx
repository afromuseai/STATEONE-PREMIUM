import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Shield, Zap, Layers, BarChart, Server, Globe } from 'lucide-react';

export function AuthPage() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#050505] text-white font-['Inter'] overflow-hidden">
      
      {/* LEFT SIDE - Cinematic OS Showcase */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        
        {/* Ambient Glows */}
        <div className="absolute top-1/4 -left-1/4 w-[500px] h-[500px] bg-[#FBBF24]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#D4AF37]/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FBBF24] to-[#D4AF37] flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.3)]">
              <span className="text-[#050505] font-bold text-2xl tracking-tighter">S1</span>
            </div>
            <span className="text-xl font-medium tracking-wide">STAGEONE</span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-medium tracking-tight leading-tight text-white/90 max-w-md">
            The AI Operating System for Modern Business
          </h1>
        </div>

        {/* Floating Dashboards */}
        <div className="relative z-10 flex-1 flex items-center justify-center mt-12 mb-12 perspective-[1000px]">
          <motion.div 
            initial={{ opacity: 0, rotateX: 20, y: 40 }}
            animate={{ opacity: 1, rotateX: 10, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative w-full max-w-lg preserve-3d"
          >
            {/* Panel 3: Website Architect (Back) */}
            <motion.div 
              animate={{ y: [-10, 10, -10] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 0.4 }}
              className="absolute -top-16 -right-8 w-64 h-48 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                <Globe className="w-4 h-4 text-white/50" />
                <span className="text-xs text-white/50 font-medium">Website Architect</span>
              </div>
              <div className="space-y-3">
                <div className="w-full h-8 bg-white/5 rounded-md" />
                <div className="flex gap-2">
                  <div className="w-1/2 h-16 bg-white/5 rounded-md" />
                  <div className="w-1/2 h-16 bg-[#FBBF24]/10 border border-[#FBBF24]/20 rounded-md" />
                </div>
              </div>
            </motion.div>

            {/* Panel 2: AI Agents (Middle) */}
            <motion.div 
              animate={{ y: [10, -10, 10] }}
              transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 0.2 }}
              className="absolute top-8 -left-12 w-72 h-56 bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl z-10"
            >
              <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                <Server className="w-4 h-4 text-white/50" />
                <span className="text-xs text-white/50 font-medium">Active Agents</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: "Research_Bot_v4", status: "amber" },
                  { name: "Data_Synthesizer", status: "green" },
                  { name: "Market_Monitor", status: "green" }
                ].map((agent, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
                        <Zap className="w-3 h-3 text-white/70" />
                      </div>
                      <span className="text-xs text-white/80 font-mono">{agent.name}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${agent.status === 'amber' ? 'bg-[#FBBF24] shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]'}`} />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Panel 1: Business Intelligence (Front) */}
            <motion.div 
              animate={{ y: [-5, 5, -5] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className="relative w-80 h-64 bg-gradient-to-b from-[#111] to-[#0a0a0a] backdrop-blur-2xl border border-white/15 rounded-2xl p-5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] z-20 left-12 top-24"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <BarChart className="w-4 h-4 text-[#FBBF24]" />
                  <span className="text-xs text-white/70 font-medium tracking-wide uppercase">Intelligence</span>
                </div>
                <span className="text-xs text-[#FBBF24] bg-[#FBBF24]/10 px-2 py-0.5 rounded-full border border-[#FBBF24]/20">Live</span>
              </div>
              
              <div className="mb-6">
                <span className="block text-3xl font-light text-white">$142,854<span className="text-white/40 text-lg">.00</span></span>
                <span className="text-xs text-green-400 flex items-center mt-1">+12.4% vs last month</span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/50">Processing Load</span>
                    <span className="text-white/80">78%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#FBBF24] to-[#D4AF37] w-[78%] rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/50">Memory Usage</span>
                    <span className="text-white/80">42%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-white/40 w-[42%] rounded-full" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Trust Badges */}
        <div className="relative z-10 flex items-center gap-6 text-xs text-white/40 font-medium tracking-wide">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Enterprise Grade</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>Multi-Model AI</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>Instant Deploy</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-[#080808] relative">
        <div className="w-full max-w-md">
          
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="flex items-center gap-3 mb-12 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FBBF24] to-[#D4AF37] flex items-center justify-center">
              <span className="text-[#050505] font-bold tracking-tighter">S1</span>
            </div>
            <span className="text-lg font-medium tracking-wide">STAGEONE</span>
          </div>

          {/* Form Container */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl relative"
          >
            {/* Tabs */}
            <div className="flex p-1 bg-white/5 rounded-xl mb-8 border border-white/5">
              <button
                onClick={() => setActiveTab('signin')}
                className={`flex-1 text-sm font-medium py-2.5 rounded-lg transition-all duration-200 ${
                  activeTab === 'signin' 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab('signup')}
                className={`flex-1 text-sm font-medium py-2.5 rounded-lg transition-all duration-200 ${
                  activeTab === 'signup' 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                Create Account
              </button>
            </div>

            {activeTab === 'signin' ? (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h2 className="text-2xl font-semibold mb-2">Welcome back</h2>
                <p className="text-white/50 text-sm mb-8">Continue building your business.</p>

                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input 
                      type="email" 
                      placeholder="Email address" 
                      className="w-full bg-[#050505]/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FBBF24]/50 focus:ring-1 focus:ring-[#FBBF24]/50 transition-all"
                    />
                  </div>
                  
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Password" 
                      className="w-full bg-[#050505]/50 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FBBF24]/50 focus:ring-1 focus:ring-[#FBBF24]/50 transition-all"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <div className="flex justify-end">
                    <a href="#" className="text-xs text-[#FBBF24] hover:text-[#D4AF37] transition-colors">Forgot password?</a>
                  </div>

                  <button className="w-full group relative flex items-center justify-center gap-2 bg-gradient-to-r from-[#FBBF24] to-[#D4AF37] text-[#050505] font-medium py-3 rounded-xl hover:opacity-90 transition-all">
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h2 className="text-2xl font-semibold mb-2">Start building.</h2>
                <p className="text-white/50 text-sm mb-8">Your AI business OS awaits.</p>

                <div className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input 
                      type="text" 
                      placeholder="Full name" 
                      className="w-full bg-[#050505]/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FBBF24]/50 focus:ring-1 focus:ring-[#FBBF24]/50 transition-all"
                    />
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input 
                      type="email" 
                      placeholder="Email address" 
                      className="w-full bg-[#050505]/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FBBF24]/50 focus:ring-1 focus:ring-[#FBBF24]/50 transition-all"
                    />
                  </div>
                  
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Password" 
                      className="w-full bg-[#050505]/50 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FBBF24]/50 focus:ring-1 focus:ring-[#FBBF24]/50 transition-all"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button className="w-full group relative flex items-center justify-center gap-2 bg-gradient-to-r from-[#FBBF24] to-[#D4AF37] text-[#050505] font-medium py-3 rounded-xl hover:opacity-90 transition-all mt-6">
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}

            <div className="mt-8">
              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-white/30 text-xs uppercase tracking-wider">or</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>
              
              <button className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-3 rounded-xl transition-all">
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                  <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335"></path>
                  <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4"></path>
                  <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05"></path>
                  <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26537 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853"></path>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            <div className="mt-8 text-center">
              {activeTab === 'signin' ? (
                <button onClick={() => setActiveTab('signup')} className="text-sm text-white/50 hover:text-white transition-colors">
                  Don't have an account? <span className="text-[#FBBF24]">Create one →</span>
                </button>
              ) : (
                <button onClick={() => setActiveTab('signin')} className="text-sm text-white/50 hover:text-white transition-colors">
                  Already have an account? <span className="text-[#FBBF24]">Sign in →</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
