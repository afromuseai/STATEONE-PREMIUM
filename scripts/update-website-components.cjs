const { Pool } = require('/home/joshua/Desktop/STATEONE-PREMIUM/node_modules/.pnpm/pg@8.20.0/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql:///stageone?host=/var/run/postgresql' });

const HERO_TSX = `'use client'

import { motion } from 'framer-motion'

const floatingShapes = [
  { size: 60, x: '10%', y: '20%', delay: 0, duration: 6, color: 'from-primary-400/30 to-accent-400/20' },
  { size: 40, x: '85%', y: '15%', delay: 1, duration: 8, color: 'from-accent-400/30 to-primary-400/20' },
  { size: 80, x: '75%', y: '70%', delay: 2, duration: 7, color: 'from-primary-500/20 to-accent-500/10' },
  { size: 30, x: '20%', y: '75%', delay: 0.5, duration: 5, color: 'from-accent-300/30 to-primary-300/20' },
  { size: 50, x: '50%', y: '10%', delay: 1.5, duration: 9, color: 'from-primary-300/20 to-accent-300/10' },
]

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-gray-900 via-primary-950 to-gray-900">
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: '60px 60px'
        }} />
      </div>
      
      <div className="absolute inset-0 overflow-hidden">
        {floatingShapes.map((shape, i) => (
          <motion.div
            key={i}
            className={"absolute rounded-full blur-3xl bg-gradient-to-br " + shape.color}
            style={{ width: shape.size * 3, height: shape.size * 3, left: shape.x, top: shape.y }}
            animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0] }}
            transition={{ duration: shape.duration, repeat: Infinity, ease: 'easeInOut', delay: shape.delay }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Trusted by 500+ engineering teams
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6">
              <span className="text-white">Accelerate Your</span>{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400">
                Testing Workflow
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 leading-relaxed mb-10 max-w-xl">
              TestFlow is the leading solution for automated testing in containerized environments. Cut test execution time by 70%, eliminate flaky tests, and ship with confidence.
            </p>

            <div className="flex flex-wrap gap-4">
              <motion.a whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} href="#cta"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/25">
                Get Started Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </motion.a>
              <motion.a whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} href="#testimonials"
                className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300">
                See How It Works
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </motion.a>
            </div>

            <div className="mt-12 flex items-center gap-6 text-sm text-gray-500">
              <div className="flex -space-x-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-gray-800 bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-xs text-gray-300 font-medium">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span><strong className="text-gray-300">12k+</strong> developers</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative hidden lg:block"
          >
            <div className="relative bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-xs text-gray-500">testflow run --ci</span>
                </div>
                <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs leading-relaxed">
                  <div className="text-emerald-400">$ testflow run --suite=regression --parallel=8</div>
                  <div className="text-gray-400 mt-1">{'\u2713'} 142 tests passed (12.4s)</div>
                  <div className="text-gray-400">{'\u2713'} 0 failed</div>
                  <div className="text-gray-400">{'\u2713'} Coverage: 94.7%</div>
                  <div className="text-blue-400 mt-1">{'\u203A'} Time saved: 37.2s (75% faster)</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 bg-white/5 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-2">Execution Time</div>
                  <div className="flex items-end gap-1 h-16">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <div key={i} className="flex-1 bg-gradient-to-t from-blue-500 to-violet-500 rounded-t-sm" style={{ height: h + '%' }} />
                    ))}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 flex flex-col justify-center">
                  <div className="text-2xl font-bold text-white">94%</div>
                  <div className="text-xs text-gray-500">Pass Rate</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 flex flex-col justify-center">
                  <div className="text-2xl font-bold text-emerald-400">3.2x</div>
                  <div className="text-xs text-gray-500">Faster deploys</div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}`;

const FEATURES_TSX = `'use client'

import { motion } from 'framer-motion'

const featureList = [
  {
    svg: '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>',
    title: 'Lightning Fast',
    desc: 'Cut test execution time by up to 70% with intelligent caching and parallel execution across containers.',
    gradient: 'from-yellow-400 to-orange-500',
    bgGlow: 'bg-yellow-500/10',
  },
  {
    svg: '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>',
    title: 'Enterprise Security',
    desc: 'SOC 2 compliant infrastructure with end-to-end encryption, RBAC, and audit logging for peace of mind.',
    gradient: 'from-emerald-400 to-teal-500',
    bgGlow: 'bg-emerald-500/10',
  },
  {
    svg: '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>',
    title: 'Container Native',
    desc: 'Seamless integration with Docker, Kubernetes, and all major container orchestration platforms.',
    gradient: 'from-blue-400 to-indigo-500',
    bgGlow: 'bg-blue-500/10',
  },
  {
    svg: '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>',
    title: 'CI/CD Native',
    desc: 'Plug-and-play integrations with GitHub Actions, GitLab CI, Jenkins, and every major pipeline tool.',
    gradient: 'from-violet-400 to-fuchsia-500',
    bgGlow: 'bg-violet-500/10',
  },
  {
    svg: '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>',
    title: 'Team Collaboration',
    desc: 'Shared test suites, parallel workspaces, and real-time dashboards built for growing engineering orgs.',
    gradient: 'from-pink-400 to-rose-500',
    bgGlow: 'bg-pink-500/10',
  },
  {
    svg: '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
    title: 'Smart Scheduling',
    desc: 'AI-driven test scheduling prioritizes critical paths, reducing feedback loops from hours to minutes.',
    gradient: 'from-cyan-400 to-blue-500',
    bgGlow: 'bg-cyan-500/10',
  },
]

export default function Features() {
  return (
    <section className="relative py-24 bg-gray-900 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.2) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400 mb-4">Why TestFlow</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything you need to{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400">ship with confidence</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Purpose-built for engineering teams who demand reliability, speed, and seamless integration with their containerized workflows.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: '-50px' }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featureList.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }} whileHover={{ y: -4 }}
              className="group relative bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-7 transition-colors hover:bg-white/[0.07]">
              <div className={'w-12 h-12 rounded-xl flex items-center justify-center mb-5 ' + f.bgGlow + ' text-white'}
                dangerouslySetInnerHTML={{ __html: f.svg }} />
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              <div className={'absolute bottom-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r ' + f.gradient + ' opacity-0 group-hover:opacity-100 transition-opacity duration-300'} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}`;

const TESTIMONIALS_TSX = `'use client'

import { motion } from 'framer-motion'

const items = [
  { quote: '"TestFlow reduced our test suite time from 45 minutes to 12 minutes. We have cut CI costs by 60% and increased deployment frequency by 3x."',
    name: 'Sarah Chen', role: 'Lead Engineer, TechCorp', initial: 'S' },
  { quote: '"The container-native approach is a game changer. We can now run our entire e2e suite in parallel across 16 containers with zero flakiness."',
    name: 'Marcus Rivera', role: 'VP Engineering, DataFlow', initial: 'M' },
  { quote: '"Setting up took less than an hour. The developer experience is incredible — our team adopted it without any resistance."',
    name: 'Emily Nakamura', role: 'Tech Lead, BuildScale', initial: 'E' },
]

export default function Testimonials() {
  return (
    <section className="relative py-24 bg-gray-950 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.015]">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '80px 80px'
        }} />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400 mb-4">Testimonials</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Trusted by{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400">engineering teams</span>
            {' '}worldwide
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Hear how TestFlow transforms testing workflows for companies that ship software at scale.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {items.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }} whileHover={{ y: -4 }}
              className="relative bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
              <svg className="w-8 h-8 text-white/20 mb-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <p className="text-gray-300 mb-6 leading-relaxed italic">{item.quote}</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-semibold text-white">
                  {item.initial}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{item.name}</h3>
                  <p className="text-sm text-gray-500">{item.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 p-8 rounded-2xl bg-white/5 border border-white/10">
          {[
            { label: 'Tests Executed', value: '2.4M+' },
            { label: 'Minutes Saved', value: '180k+' },
            { label: 'Active Teams', value: '500+' },
            { label: 'Avg. Speed-up', value: '4.2x' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}`;

const CTA_TSX = `'use client'

import { motion } from 'framer-motion'

export default function CTA() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-violet-700 to-fuchsia-800" />
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/20 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            Ready to Transform Your Testing Workflow?
          </h2>
          <p className="text-blue-100/80 mb-10 max-w-2xl mx-auto text-lg">
            Join thousands of developers who ship faster with reliable, container-native testing. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} href="#"
              className="bg-white text-gray-900 hover:bg-gray-100 font-semibold px-8 py-4 rounded-xl text-lg transition-all duration-300 shadow-xl">
              Start Free Trial
            </motion.a>
            <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} href="#"
              className="border-2 border-white/30 hover:border-white/60 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all duration-300">
              Book a Demo
            </motion.a>
          </div>
          <p className="text-blue-200/60 mt-8 text-sm">No credit card required &bull; 14-day free trial &bull; Cancel anytime</p>
        </motion.div>
      </div>
    </section>
  )
}`;

const LAYOUT_TSX = `import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'TestFlow - Accelerate Your Testing Workflow',
  description: 'TestFlow is the leading solution for automated testing in containerized environments.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="antialiased bg-gray-950 text-white">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <a href="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400">
                TestFlow
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
                <a href="#testimonials" className="text-sm text-gray-400 hover:text-white transition-colors">Testimonials</a>
                <a href="#cta" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
              </div>
              <a href="#cta" className="text-sm bg-gradient-to-r from-blue-500 to-violet-600 text-white px-5 py-2 rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all">
                Get Started
              </a>
            </div>
          </div>
        </nav>
        <main className="pt-16">{children}</main>
        <footer className="border-t border-white/10 bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="col-span-2 md:col-span-1">
                <a href="/" className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400">TestFlow</a>
                <p className="mt-3 text-sm text-gray-500 max-w-xs">The leading solution for automated testing in containerized environments.</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
                <ul className="space-y-3">
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Features</a></li>
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Pricing</a></li>
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Integrations</a></li>
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Changelog</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
                <ul className="space-y-3">
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">About</a></li>
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Blog</a></li>
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Careers</a></li>
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Contact</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
                <ul className="space-y-3">
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Privacy</a></li>
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Terms</a></li>
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Security</a></li>
                  <li><a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Cookies</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-sm text-gray-600">&copy; 2026 TestFlow. All rights reserved.</p>
              <div className="flex gap-4">
                <a href="#" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">Twitter</a>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">GitHub</a>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">Discord</a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}`;

async function main() {
  const r = await pool.query('SELECT files FROM website_v2_projects WHERE id = $1', ['e1cb6921-d4e0-46a7-bd5a-54ff58a3055b']);
  const files = r.rows[0].files;
  
  // Update each file
  const heroFile = files.find(f => f.path === 'components/Hero.tsx');
  heroFile.content = HERO_TSX;
  
  const featuresFile = files.find(f => f.path === 'components/Features.tsx');
  featuresFile.content = FEATURES_TSX;
  
  const testimonialsFile = files.find(f => f.path === 'components/Testimonials.tsx');
  testimonialsFile.content = TESTIMONIALS_TSX;
  
  const ctaFile = files.find(f => f.path === 'components/CTA.tsx');
  ctaFile.content = CTA_TSX;
  
  const layoutFile = files.find(f => f.path === 'app/layout.tsx');
  layoutFile.content = LAYOUT_TSX;
  
  // Write back
  const json = JSON.stringify(files);
  await pool.query('UPDATE website_v2_projects SET files = $1 WHERE id = $2', [json, 'e1cb6921-d4e0-46a7-bd5a-54ff58a3055b']);
  
  // Verify
  const r2 = await pool.query('SELECT files FROM website_v2_projects WHERE id = $1', ['e1cb6921-d4e0-46a7-bd5a-54ff58a3055b']);
  const updatedFiles = r2.rows[0].files;
  const heroCheck = updatedFiles.find(f => f.path === 'components/Hero.tsx');
  console.log('Hero.tsx updated:', heroCheck.content.includes('floatingShapes') ? 'YES' : 'NO');
  console.log('Hero length:', heroCheck.content.length);
  
  const featuresCheck = updatedFiles.find(f => f.path === 'components/Features.tsx');
  console.log('Features.tsx updated:', featuresCheck.content.includes('featureList') ? 'YES' : 'NO');
  
  const layoutCheck = updatedFiles.find(f => f.path === 'app/layout.tsx');
  console.log('layout.tsx updated:', layoutCheck.content.includes('pt-16') ? 'YES' : 'NO');
  
  pool.end();
}

main().catch(e => { console.error('ERROR:', e.message); pool.end(); });
