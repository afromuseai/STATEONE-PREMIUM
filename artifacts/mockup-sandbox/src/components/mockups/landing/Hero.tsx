import React from "react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { 
  ArrowRight, 
  BarChart3, 
  BrainCircuit, 
  Cpu, 
  Globe, 
  Layers, 
  Layout, 
  Network, 
  Play, 
  Server, 
  Shield, 
  Sparkles, 
  Zap 
} from "lucide-react";

// --- ANIMATION VARIANTS ---
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const glowAnim: Record<string, any> = {
  initial: { opacity: 0.5, scale: 0.9 },
  animate: { 
    opacity: [0.4, 0.8, 0.4], 
    scale: [0.95, 1.05, 0.95],
    transition: { duration: 8, repeat: Infinity, ease: "easeInOut" }
  }
};

// --- COMPONENTS ---

const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-xl border-b border-white/5">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_15px_rgba(251,191,36,0.3)]">
        <span className="text-black font-bold text-sm tracking-tighter">S1</span>
      </div>
      <span className="text-white font-medium tracking-wide text-sm">STAGEONE</span>
    </div>
    
    <div className="hidden md:flex items-center gap-8 text-sm text-neutral-400">
      <a href="#features" className="hover:text-white transition-colors">Features</a>
      <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
      <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
    </div>

    <div className="flex items-center gap-4">
      <button className="text-sm text-neutral-300 hover:text-white transition-colors hidden sm:block">Log In</button>
      <button className="group relative px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium text-white transition-all overflow-hidden">
        <span className="relative z-10 flex items-center gap-2">
          Start Building <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </span>
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      </button>
    </div>
  </nav>
);

const HeroSection = () => {
  return (
    <section className="relative min-h-screen pt-32 pb-20 px-6 flex flex-col items-center justify-center overflow-hidden">
      {/* Background Glows */}
      <motion.div 
        variants={glowAnim}
        initial="initial"
        animate="animate"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none"
      />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />

      <div className="relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-medium uppercase tracking-wider mb-8"
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Business Operating System
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-6xl md:text-8xl font-bold text-white tracking-tighter leading-[1.1] mb-6"
        >
          Build. Automate. Scale.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-400 via-white to-neutral-500">
            With AI at the Core.
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light"
        >
          STAGEONE transforms your business idea into a complete strategic blueprint, 
          live website, autonomous agents, and deployment-ready infrastructure — instantly.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 mb-20"
        >
          <button className="px-8 py-4 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full text-black font-semibold shadow-[0_0_40px_rgba(251,191,36,0.3)] hover:shadow-[0_0_60px_rgba(251,191,36,0.5)] transition-all flex items-center gap-2">
            Start Building <ArrowRight className="w-4 h-4" />
          </button>
          <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-full text-white font-medium hover:bg-white/10 transition-all flex items-center gap-2">
            <Play className="w-4 h-4" fill="currentColor" /> Watch How It Works
          </button>
        </motion.div>

        {/* Dashboard Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 60, rotateX: 20 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-5xl aspect-[16/9] relative rounded-2xl border border-white/10 bg-black/50 backdrop-blur-2xl shadow-2xl overflow-hidden group perspective-[2000px]"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          
          {/* Mac window controls */}
          <div className="h-10 border-b border-white/5 flex items-center px-4 gap-2 bg-white/5">
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
          </div>

          {/* Mockup Content */}
          <div className="p-6 grid grid-cols-12 gap-6 h-[calc(100%-40px)]">
            {/* Sidebar */}
            <div className="col-span-3 flex flex-col gap-4">
              <div className="h-8 w-24 bg-white/10 rounded-md mb-4" />
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-6 w-full bg-white/5 rounded-md" />
              ))}
              <div className="mt-auto h-24 w-full bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-xl p-4 flex flex-col justify-end">
                <div className="h-2 w-1/2 bg-amber-500/40 rounded-full mb-2" />
                <div className="h-2 w-3/4 bg-amber-500/20 rounded-full" />
              </div>
            </div>

            {/* Main Content */}
            <div className="col-span-9 flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-full bg-white/10" />
                    <div className="h-4 w-1/2 bg-white/20 rounded-full" />
                  </div>
                ))}
              </div>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" />
                <div className="flex justify-between items-end h-full w-full gap-2">
                  {[40, 70, 45, 90, 65, 80, 50, 95, 60, 85].map((h, i) => (
                    <motion.div 
                      key={i} 
                      className="w-full bg-gradient-to-t from-amber-500/20 to-amber-500/60 rounded-t-sm"
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 1.5, delay: 0.8 + (i * 0.1), ease: "easeOut" }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-16 flex flex-wrap justify-center gap-x-12 gap-y-6 text-sm text-neutral-500 uppercase tracking-widest font-medium"
        >
          <span>12 AI Agents</span>
          <span className="hidden sm:inline">•</span>
          <span>3-Step Workflow</span>
          <span className="hidden sm:inline">•</span>
          <span>Real-time Generation</span>
          <span className="hidden sm:inline">•</span>
          <span>Enterprise Ready</span>
        </motion.div>
      </div>
    </section>
  );
};

const ShowcaseSection = () => {
  return (
    <section id="features" className="py-32 px-6 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-24">
          <motion.h2 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight"
          >
            One Platform. Every Business System.
          </motion.h2>
          <motion.p 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-neutral-400 text-lg max-w-2xl mx-auto"
          >
            A seamlessly integrated ecosystem replacing fragmented tools with cohesive AI orchestration.
          </motion.p>
        </div>

        <div className="flex flex-col gap-12 lg:gap-24">
          {/* Card 1 */}
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}
            className="relative h-[400px] md:h-[500px] rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent overflow-hidden group flex flex-col md:flex-row items-center"
          >
            <div className="w-full md:w-1/2 p-12 z-10">
              <BarChart3 className="w-10 h-10 text-amber-400 mb-6" />
              <h3 className="text-3xl font-bold text-white mb-4">Business Intelligence</h3>
              <p className="text-neutral-400 text-lg leading-relaxed">
                Real-time insights synthesized from every corner of your business. AI that doesn't just report data, but prescribes action.
              </p>
            </div>
            <div className="w-full md:w-1/2 h-full relative perspective-[1000px]">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 w-[120%] aspect-square bg-white/5 rounded-2xl border border-white/10 transform rotate-y-[-15deg] rotate-x-[5deg] shadow-2xl p-6 flex flex-col gap-4 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-4">
                  <div className="h-4 w-32 bg-white/10 rounded" />
                  <div className="h-4 w-16 bg-amber-500/20 rounded" />
                </div>
                <div className="flex-1 flex items-end gap-2 border-b border-white/10 pb-4">
                  {[30, 50, 40, 70, 60, 90, 85].map((h, i) => (
                    <div key={i} className="w-full bg-white/10 rounded-t-sm transition-all duration-1000 group-hover:bg-amber-500/20" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="h-24 bg-white/5 rounded-xl border border-white/5 p-4" />
              </div>
            </div>
          </motion.div>

          {/* Card 2 */}
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}
            className="relative h-[400px] md:h-[500px] rounded-3xl border border-white/10 bg-gradient-to-bl from-white/5 to-transparent overflow-hidden group flex flex-col md:flex-row-reverse items-center"
          >
            <div className="w-full md:w-1/2 p-12 z-10">
              <Layout className="w-10 h-10 text-amber-400 mb-6" />
              <h3 className="text-3xl font-bold text-white mb-4">Website Architect</h3>
              <p className="text-neutral-400 text-lg leading-relaxed">
                Instantly generate, deploy, and iterate on high-converting landing pages tailored to your exact strategic positioning.
              </p>
            </div>
            <div className="w-full md:w-1/2 h-full relative perspective-[1000px]">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/4 w-[120%] aspect-square bg-[#050505] rounded-2xl border border-white/10 transform rotate-y-[15deg] rotate-x-[5deg] shadow-2xl overflow-hidden">
                <div className="h-8 bg-white/5 border-b border-white/10 flex items-center px-4 gap-2">
                  <div className="h-3 w-3 rounded-full bg-white/20" />
                  <div className="h-3 w-3 rounded-full bg-white/20" />
                  <div className="h-3 w-3 rounded-full bg-white/20" />
                </div>
                <div className="p-8 flex flex-col items-center justify-center text-center gap-6 h-full">
                  <div className="h-12 w-3/4 bg-gradient-to-r from-white/20 to-white/5 rounded-lg" />
                  <div className="h-4 w-1/2 bg-white/10 rounded" />
                  <div className="h-10 w-32 bg-amber-500/20 rounded-full mt-4" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 3 */}
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}
            className="relative h-[400px] md:h-[500px] rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent overflow-hidden group flex flex-col md:flex-row items-center"
          >
            <div className="w-full md:w-1/2 p-12 z-10">
              <BrainCircuit className="w-10 h-10 text-amber-400 mb-6" />
              <h3 className="text-3xl font-bold text-white mb-4">AI Execution Engine</h3>
              <p className="text-neutral-400 text-lg leading-relaxed">
                Deploy autonomous agents to execute marketing, sales, and operational tasks around the clock with perfect context.
              </p>
            </div>
            <div className="w-full md:w-1/2 h-full relative perspective-[1000px] flex items-center justify-center">
               <div className="relative w-[120%] h-[120%] transform rotate-y-[-15deg] rotate-x-[15deg] flex items-center justify-center">
                  {/* Central Node */}
                  <div className="absolute w-20 h-20 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                  <div className="absolute w-12 h-12 bg-white/10 border border-amber-500/50 rounded-full z-10 flex items-center justify-center backdrop-blur-md">
                    <BrainCircuit className="w-5 h-5 text-amber-400" />
                  </div>
                  
                  {/* Orbiting Nodes */}
                  {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                    <motion.div 
                      key={i}
                      className="absolute w-40 h-40 border border-white/10 rounded-full"
                      style={{ rotate: `${deg}deg` }}
                      animate={{ rotate: `${deg + 360}deg` }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    >
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#0a0a0a] border border-white/20 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white/50 rounded-full" />
                      </div>
                    </motion.div>
                  ))}
               </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

const HowItWorksSection = () => {
  const steps = [
    { num: "01", title: "Describe Your Vision", desc: "Input your business concept in plain english. S1 processes intent and context." },
    { num: "02", title: "AI Orchestration", desc: "Our engine architects systems, builds landing pages, and configures agents." },
    { num: "03", title: "Launch & Scale", desc: "Deploy instantly to production infrastructure with one click." }
  ];

  return (
    <section id="how-it-works" className="py-32 px-6 bg-[#030303] border-y border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-24">
          <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white mb-6">
            From Idea to Operating Business in 3 Steps
          </motion.h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12 pt-10">
          {/* Connecting Line */}
          <div className="hidden md:block absolute top-[45px] left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              className="relative flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-black border border-white/10 flex items-center justify-center text-xl font-bold text-amber-400 mb-8 shadow-[0_0_30px_rgba(251,191,36,0.1)] relative z-10">
                {step.num}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
              <p className="text-neutral-400 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FeaturesGrid = () => {
  const features = [
    { icon: BarChart3, title: "Business Intelligence", desc: "Unified dashboards tracking vital metrics in real-time." },
    { icon: Layout, title: "Website Architect", desc: "AI-generated React applications ready for production." },
    { icon: Zap, title: "AI Execution Engine", desc: "Automate workflows across your entire tool stack." },
    { icon: Network, title: "Agent Systems", desc: "Deploy specialized AI workers for distinct roles." },
    { icon: BrainCircuit, title: "AI Memory", desc: "Persistent contextual awareness across all operations." },
    { icon: Server, title: "Enterprise Deployments", desc: "Secure, scalable infrastructure out of the box." }
  ];

  return (
    <section className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">The Complete AI Business OS</h2>
          <p className="text-neutral-400">Everything you need to scale, built into one cohesive platform.</p>
        </motion.div>

        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((f, i) => (
            <motion.div 
              key={i} variants={fadeUp}
              className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-colors group"
            >
              <f.icon className="w-8 h-8 text-neutral-500 group-hover:text-amber-400 transition-colors mb-6" />
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const TrustSection = () => (
  <section className="py-24 px-6 border-y border-white/5 bg-black/50">
    <div className="max-w-6xl mx-auto text-center">
      <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-sm font-medium text-amber-400 uppercase tracking-widest mb-12">
        Built for the Next Generation of Business Operators
      </motion.p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-white">
        {[
          { icon: Shield, text: "Enterprise-Grade Infrastructure" },
          { icon: Layers, text: "Multi-Model AI Pipeline" },
          { icon: Cpu, text: "Production-Ready Output" }
        ].map((item, i) => (
          <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <item.icon className="w-5 h-5 text-neutral-300" />
            </div>
            <span className="font-medium text-neutral-200">{item.text}</span>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const CTASection = () => (
  <section className="py-32 px-6">
    <div className="max-w-4xl mx-auto relative">
      <div className="absolute inset-0 bg-amber-500/10 blur-[100px] rounded-full" />
      <motion.div 
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
        className="relative p-12 md:p-20 rounded-3xl bg-[#080808] border border-white/10 text-center shadow-2xl overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        <div className="relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">Ready to Build Your AI-Powered Business?</h2>
          <p className="text-neutral-400 text-lg mb-10 max-w-xl mx-auto">
            Stop stitching together fragmented tools. Launch your business on the definitive AI Operating System today.
          </p>
          <button className="px-8 py-4 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full text-black font-semibold shadow-[0_0_40px_rgba(251,191,36,0.2)] hover:shadow-[0_0_60px_rgba(251,191,36,0.4)] transition-all flex items-center gap-2 mx-auto">
            Start Building Free <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="py-12 px-6 border-t border-white/5">
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-neutral-500">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
          <span className="text-black font-bold text-[10px] tracking-tighter">S1</span>
        </div>
        <span className="font-medium text-neutral-300">STAGEONE</span>
      </div>
      <div className="flex gap-6">
        <a href="#" className="hover:text-white transition-colors">Privacy</a>
        <a href="#" className="hover:text-white transition-colors">Terms</a>
        <a href="#" className="hover:text-white transition-colors">Twitter</a>
      </div>
      <div>© {new Date().getFullYear()} STAGEONE Inc. All rights reserved.</div>
    </div>
  </footer>
);

export function Hero() {
  return (
    <div className="min-h-screen bg-[#050505] font-['Inter'] selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <ShowcaseSection />
      <HowItWorksSection />
      <FeaturesGrid />
      <TrustSection />
      <CTASection />
      <Footer />
    </div>
  );
}
