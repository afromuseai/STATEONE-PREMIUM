import React, { useState } from "react";
import { Check, X, ChevronDown, ChevronRight, Zap, Sparkles } from "lucide-react";

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

export function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-['Inter'] selection:bg-amber-500/30 overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute top-[20%] right-[-20%] w-[60%] h-[60%] bg-amber-500/10 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-purple-500/10 blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10">
        {/* Navbar */}
        <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-black fill-black" />
              </div>
              <span className="font-bold tracking-wider text-sm">STAGEONE</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
              <a href="#" className="hover:text-white transition-colors">Features</a>
              <a href="#" className="hover:text-white transition-colors">Solutions</a>
              <a href="#" className="text-white">Pricing</a>
              <a href="#" className="hover:text-white transition-colors">Docs</a>
            </div>

            <div className="flex items-center gap-4">
              <a href="#" className="text-sm font-medium text-zinc-400 hover:text-white hidden md:block transition-colors">Sign In</a>
              <button className="h-9 px-4 rounded-full bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors flex items-center gap-2">
                Start Building <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 pt-24 pb-32">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 mb-10">
              Start free. Scale with your ambition. Go enterprise when you're ready.
            </p>

            <div className="flex items-center justify-center gap-4 text-sm font-medium">
              <span className={cn("transition-colors", !isAnnual ? "text-white" : "text-zinc-500")}>Monthly</span>
              <button 
                onClick={() => setIsAnnual(!isAnnual)}
                className="w-12 h-6 rounded-full bg-white/10 relative border border-white/20 transition-colors hover:border-white/30"
              >
                <div className={cn(
                  "absolute top-[2px] w-4 h-4 rounded-full bg-white transition-transform duration-300",
                  isAnnual ? "left-[26px] bg-amber-400" : "left-[2px]"
                )} />
              </button>
              <span className={cn("transition-colors flex items-center gap-2", isAnnual ? "text-white" : "text-zinc-500")}>
                Annual
                <span className="text-[10px] uppercase tracking-wider bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded border border-amber-400/20">
                  Save 20%
                </span>
              </span>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32 items-start">
            {/* Starter */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-8 flex flex-col h-full relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
              <div className="mb-8">
                <h3 className="text-xl font-medium mb-2">Starter</h3>
                <p className="text-sm text-zinc-400 h-10">Perfect for exploring STAGEONE</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-bold">$0</span>
                  <span className="text-zinc-500">/mo</span>
                </div>
              </div>
              
              <button className="w-full py-3 rounded-lg border border-white/20 text-sm font-medium hover:bg-white/5 transition-colors mb-8">
                Get Started Free
              </button>

              <div className="space-y-4 text-sm text-zinc-300 flex-grow">
                <FeatureItem text="3 Business Intelligence Reports/mo" />
                <FeatureItem text="1 AI-Generated Website" />
                <FeatureItem text="Basic AI Agent (1 agent)" />
                <FeatureItem text="5 Project slots" />
                <FeatureItem text="Community support" />
                <FeatureItem text="Standard generation speed" />
              </div>
            </div>

            {/* Pro */}
            <div className="rounded-2xl bg-[#0a0a0a] border border-amber-400/40 p-8 flex flex-col h-full relative transform md:-translate-y-4 shadow-[0_0_40px_-10px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/20">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50" />
              <div className="absolute -top-3 right-8">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.5)] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Most Popular
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-medium mb-2 text-amber-50">Pro</h3>
                <p className="text-sm text-zinc-400 h-10">For founders and growing teams</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-bold">{isAnnual ? '$39' : '$49'}</span>
                  <span className="text-zinc-500">/mo</span>
                </div>
                {isAnnual && <p className="text-xs text-amber-400/80 mt-2">Billed $468 annually</p>}
              </div>
              
              <button className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-bold hover:brightness-110 transition-all mb-8 shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                Start Pro Trial
              </button>

              <div className="space-y-4 text-sm text-zinc-200 flex-grow">
                <FeatureItem text="Unlimited Business Intelligence" highlight />
                <FeatureItem text="10 AI-Generated Websites/mo" highlight />
                <FeatureItem text="12 AI Agents (all categories)" highlight />
                <FeatureItem text="Unlimited Projects" />
                <FeatureItem text="AI Memory (persistent context)" />
                <FeatureItem text="Execution Engine access" />
                <FeatureItem text="Priority generation speed" />
                <FeatureItem text="Webhook integrations" />
                <FeatureItem text="API access" />
                <FeatureItem text="Email support" />
              </div>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-8 flex flex-col h-full relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
              <div className="mb-8">
                <h3 className="text-xl font-medium mb-2">Enterprise</h3>
                <p className="text-sm text-zinc-400 h-10">For serious operators and organizations</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight">Custom</span>
                </div>
              </div>
              
              <button className="w-full py-3 rounded-lg border border-white/20 text-sm font-medium hover:bg-white/5 transition-colors mb-8">
                Contact Sales
              </button>

              <div className="space-y-4 text-sm text-zinc-300 flex-grow">
                <FeatureItem text="Everything in Pro" />
                <FeatureItem text="Unlimited AI Websites" />
                <FeatureItem text="Unlimited AI Agents" />
                <FeatureItem text="Custom model configuration" />
                <FeatureItem text="Dedicated execution engine" />
                <FeatureItem text="Advanced AI Memory & learning" />
                <FeatureItem text="Enterprise SLA (99.9% uptime)" />
                <FeatureItem text="SSO / SAML" />
                <FeatureItem text="Audit logs & compliance" />
                <FeatureItem text="Dedicated success manager" />
                <FeatureItem text="Custom integrations" />
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="mb-32 overflow-x-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">Compare features</h2>
            <div className="min-w-[800px] border border-white/10 rounded-2xl overflow-hidden bg-[#0a0a0a]/50 backdrop-blur-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#111] sticky top-0 z-10">
                  <tr>
                    <th className="p-6 font-medium text-zinc-400 w-1/3 border-b border-white/10">Feature</th>
                    <th className="p-6 font-medium text-white w-2/9 border-b border-white/10">Starter</th>
                    <th className="p-6 font-medium text-amber-400 w-2/9 border-b border-white/10">Pro</th>
                    <th className="p-6 font-medium text-white w-2/9 border-b border-white/10">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <TableRowCategory title="AI Generation" />
                  <TableRow label="Business Reports" starter="3/mo" pro="Unlimited" ent="Unlimited" />
                  <TableRow label="AI Websites" starter="1 total" pro="10/mo" ent="Unlimited" />
                  <TableRow label="AI Agents" starter="1 basic" pro="12 (All types)" ent="Unlimited" />
                  <TableRow label="AI Memory" starter={<X className="w-4 h-4 text-zinc-600" />} pro={<Check className="w-4 h-4 text-amber-400" />} ent={<Check className="w-4 h-4 text-white" />} />
                  <TableRow label="Generation Speed" starter="Standard" pro="Priority" ent="Dedicated" />
                  
                  <TableRowCategory title="Platform" />
                  <TableRow label="Projects" starter="5" pro="Unlimited" ent="Unlimited" />
                  <TableRow label="Execution Engine" starter={<X className="w-4 h-4 text-zinc-600" />} pro={<Check className="w-4 h-4 text-amber-400" />} ent="Dedicated" />
                  <TableRow label="API Access" starter={<X className="w-4 h-4 text-zinc-600" />} pro={<Check className="w-4 h-4 text-amber-400" />} ent={<Check className="w-4 h-4 text-white" />} />
                  <TableRow label="Webhooks" starter={<X className="w-4 h-4 text-zinc-600" />} pro={<Check className="w-4 h-4 text-amber-400" />} ent={<Check className="w-4 h-4 text-white" />} />
                  
                  <TableRowCategory title="Support & Security" />
                  <TableRow label="Support" starter="Community" pro="Email" ent="Dedicated Manager" />
                  <TableRow label="SSO / SAML" starter={<X className="w-4 h-4 text-zinc-600" />} pro={<X className="w-4 h-4 text-zinc-600" />} ent={<Check className="w-4 h-4 text-white" />} />
                  <TableRow label="SLA" starter={<X className="w-4 h-4 text-zinc-600" />} pro={<X className="w-4 h-4 text-zinc-600" />} ent="99.9% Uptime" />
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto mb-32">
            <h2 className="text-3xl font-bold mb-12 text-center">Frequently asked questions</h2>
            <div className="divide-y divide-white/10 border-y border-white/10">
              <FaqItem 
                index={0} 
                isOpen={openFaq === 0} 
                toggle={() => toggleFaq(0)}
                question="What counts as an AI generation credit?"
                answer="A credit is consumed whenever you generate a full asset, such as a business intelligence report, a website layout, or initializing a new AI agent. Editing existing assets does not consume credits."
              />
              <FaqItem 
                index={1} 
                isOpen={openFaq === 1} 
                toggle={() => toggleFaq(1)}
                question="Can I upgrade or downgrade anytime?"
                answer="Yes, you can change your plan at any time. If you upgrade, you'll be prorated the difference. If you downgrade, you'll retain your current tier's features until the end of your billing cycle."
              />
              <FaqItem 
                index={2} 
                isOpen={openFaq === 2} 
                toggle={() => toggleFaq(2)}
                question="What is the Execution Engine?"
                answer="The Execution Engine is our proprietary infrastructure that allows your AI agents to perform real-world tasks, like making API calls, deploying code, and running background data analyses securely."
              />
              <FaqItem 
                index={3} 
                isOpen={openFaq === 3} 
                toggle={() => toggleFaq(3)}
                question="Do you offer refunds?"
                answer="We offer a 14-day money-back guarantee for all annual subscriptions. Monthly subscriptions can be canceled at any time, preventing future charges."
              />
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="relative rounded-3xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-purple-500/10 opacity-50" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-amber-500/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
            
            <div className="relative z-10 px-8 py-24 text-center max-w-2xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to transform how you build businesses?</h2>
              <p className="text-zinc-400 mb-10 text-lg">
                Join thousands of operators using STAGEONE to scale their ideas with AI.
              </p>
              <button className="h-14 px-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-lg hover:brightness-110 transition-all shadow-[0_0_30px_rgba(251,191,36,0.3)] flex items-center gap-2 mx-auto">
                Start Building Free <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

        </main>
        
        {/* Footer */}
        <footer className="border-t border-white/10 bg-[#050505] py-12 text-center text-sm text-zinc-500">
          <p>© {new Date().getFullYear()} STAGEONE. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

function FeatureItem({ text, highlight = false }: { text: string, highlight?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Check className={cn("w-5 h-5 shrink-0", highlight ? "text-amber-400" : "text-white/40")} />
      <span className={highlight ? "text-amber-100" : ""}>{text}</span>
    </div>
  );
}

function TableRowCategory({ title }: { title: string }) {
  return (
    <tr className="bg-[#151515]">
      <td colSpan={4} className="p-4 px-6 font-semibold text-white/90 text-xs uppercase tracking-wider">
        {title}
      </td>
    </tr>
  );
}

function TableRow({ label, starter, pro, ent }: { label: React.ReactNode, starter: React.ReactNode, pro: React.ReactNode, ent: React.ReactNode }) {
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="p-4 px-6 font-medium text-zinc-300">{label}</td>
      <td className="p-4 px-6 text-zinc-400">{starter}</td>
      <td className="p-4 px-6 text-amber-200/90 font-medium">{pro}</td>
      <td className="p-4 px-6 text-zinc-200">{ent}</td>
    </tr>
  );
}

function FaqItem({ question, answer, isOpen, toggle, index }: { question: string, answer: string, isOpen: boolean, toggle: () => void, index: number }) {
  return (
    <div className="py-6">
      <button 
        onClick={toggle}
        className="flex items-center justify-between w-full text-left focus:outline-none group"
      >
        <h3 className="text-lg font-medium group-hover:text-amber-400 transition-colors">{question}</h3>
        <ChevronDown className={cn("w-5 h-5 text-zinc-500 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>
      <div 
        className={cn(
          "overflow-hidden transition-all duration-300",
          isOpen ? "max-h-40 mt-4 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <p className="text-zinc-400 leading-relaxed pr-8">
          {answer}
        </p>
      </div>
    </div>
  );
}
