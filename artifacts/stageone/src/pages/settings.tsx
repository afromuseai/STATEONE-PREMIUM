import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useLocation } from "wouter"
import {
  ArrowLeft,
  User,
  Bell,
  Database,
  Trash2,
  Save,
  Check,
  LogOut,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"
import { AppSidebar } from "@/components/dashboard/app-sidebar"

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const [, setLocation] = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [projectCount, setProjectCount] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)

  const [emailUpdates, setEmailUpdates] = useState(true)

  useEffect(() => {
    const prefs = localStorage.getItem("stageone-prefs")
    if (prefs) {
      try {
        const p = JSON.parse(prefs)
        setEmailUpdates(p.emailUpdates ?? true)
      } catch { /* ignore */ }
    }
    api.projects.list().then(({ projects }) => setProjectCount(projects.length)).catch(() => {})
  }, [])

  const handleSave = () => {
    localStorage.setItem("stageone-prefs", JSON.stringify({ emailUpdates }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSignOut = async () => {
    await logout()
    setLocation("/")
  }

  const SettingSection = ({
    icon: Icon,
    title,
    description,
    children,
  }: {
    icon: typeof User
    title: string
    description: string
    children: React.ReactNode
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          <div className="mt-4 space-y-4">{children}</div>
        </div>
      </div>
    </motion.div>
  )

  const Toggle = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean
    onChange: (v: boolean) => void
    label: string
  }) => (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-primary" : "bg-secondary"}`}
      >
        <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </label>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 shrink-0">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium text-foreground">Settings</span>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Profile */}
            <SettingSection icon={User} title="Profile" description="Your account information">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Full Name</label>
                  <div className="mt-1.5 px-4 py-2.5 rounded-lg bg-secondary/30 border border-border text-foreground text-sm">
                    {user?.name ?? "—"}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Email Address</label>
                  <div className="mt-1.5 px-4 py-2.5 rounded-lg bg-secondary/30 border border-border text-foreground text-sm">
                    {user?.email ?? "—"}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Member Since</label>
                  <div className="mt-1.5 px-4 py-2.5 rounded-lg bg-secondary/30 border border-border text-muted-foreground text-sm">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}
                  </div>
                </div>
              </div>
            </SettingSection>

            {/* Notifications */}
            <SettingSection icon={Bell} title="Notifications" description="Control your notification preferences">
              <Toggle checked={emailUpdates} onChange={setEmailUpdates} label="Email updates about new features" />
            </SettingSection>


            {/* Data */}
            <SettingSection icon={Database} title="Data Management" description="Your saved projects and data">
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Saved Projects</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {projectCount === null ? "Loading…" : `${projectCount} project${projectCount !== 1 ? "s" : ""} in your account`}
                  </p>
                </div>
              </div>
            </SettingSection>


            {/* Sign Out */}
            <SettingSection icon={LogOut} title="Account" description="Session management">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all text-sm font-medium"
              >
                <Trash2 className="h-4 w-4" />
                Sign Out
              </button>
            </SettingSection>

            {/* Save */}
            <motion.div className="flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save Preferences</>}
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
