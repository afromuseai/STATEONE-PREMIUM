import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Link } from "wouter"
import { 
  ArrowLeft, 
  User, 
  Bell, 
  Palette, 
  Database,
  Key,
  Trash2,
  Save,
  Check
} from "lucide-react"

interface UserSettings {
  displayName: string
  email: string
  notifications: {
    emailUpdates: boolean
    projectAlerts: boolean
  }
  preferences: {
    defaultOutputLength: "concise" | "detailed"
    autoSave: boolean
  }
}

const defaultSettings: UserSettings = {
  displayName: "",
  email: "",
  notifications: {
    emailUpdates: true,
    projectAlerts: true
  },
  preferences: {
    defaultOutputLength: "concise",
    autoSave: true
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [saved, setSaved] = useState(false)
  const [projectCount, setProjectCount] = useState(0)

  useEffect(() => {
    const savedSettings = localStorage.getItem("stageone-settings")
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
    const savedProjects = localStorage.getItem("stageone-projects")
    if (savedProjects) {
      setProjectCount(JSON.parse(savedProjects).length)
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem("stageone-settings", JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear all project history? This cannot be undone.")) {
      localStorage.removeItem("stageone-projects")
      setProjectCount(0)
    }
  }

  const SettingSection = ({ 
    icon: Icon, 
    title, 
    description, 
    children 
  }: { 
    icon: typeof User
    title: string
    description: string
    children: React.ReactNode 
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Icon className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-neutral-500 mt-1">{description}</p>
          <div className="mt-4 space-y-4">
            {children}
          </div>
        </div>
      </div>
    </motion.div>
  )

  const Toggle = ({ 
    checked, 
    onChange, 
    label 
  }: { 
    checked: boolean
    onChange: (checked: boolean) => void
    label: string 
  }) => (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? "bg-amber-500" : "bg-neutral-700"
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  )

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-neutral-500 mt-1">Manage your STAGEONE preferences</p>
          </div>
        </div>

        <div className="space-y-4">
          <SettingSection
            icon={User}
            title="Profile"
            description="Your personal information"
          >
            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  value={settings.displayName}
                  onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                  placeholder="Enter your name"
                  className="w-full mt-1.5 px-4 py-2.5 rounded-lg bg-black/50 border border-white/10 text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="your@email.com"
                  className="w-full mt-1.5 px-4 py-2.5 rounded-lg bg-black/50 border border-white/10 text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>
          </SettingSection>

          <SettingSection
            icon={Bell}
            title="Notifications"
            description="Control your notification preferences"
          >
            <div className="space-y-3">
              <Toggle
                checked={settings.notifications.emailUpdates}
                onChange={(checked) => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, emailUpdates: checked }
                })}
                label="Email updates about new features"
              />
              <Toggle
                checked={settings.notifications.projectAlerts}
                onChange={(checked) => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, projectAlerts: checked }
                })}
                label="Project completion alerts"
              />
            </div>
          </SettingSection>

          <SettingSection
            icon={Palette}
            title="Preferences"
            description="Customize your experience"
          >
            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Default Output Length</label>
                <div className="flex gap-2 mt-2">
                  {(["concise", "detailed"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setSettings({
                        ...settings,
                        preferences: { ...settings.preferences, defaultOutputLength: option }
                      })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        settings.preferences.defaultOutputLength === option
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          : "bg-white/5 text-neutral-400 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <Toggle
                checked={settings.preferences.autoSave}
                onChange={(checked) => setSettings({
                  ...settings,
                  preferences: { ...settings.preferences, autoSave: checked }
                })}
                label="Auto-save projects"
              />
            </div>
          </SettingSection>

          <SettingSection
            icon={Database}
            title="Data Management"
            description="Manage your stored data"
          >
            <div className="flex items-center justify-between p-4 rounded-lg bg-black/30 border border-white/5">
              <div>
                <p className="text-sm text-white">Project History</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {projectCount} project{projectCount !== 1 ? "s" : ""} saved locally
                </p>
              </div>
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all text-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </SettingSection>

          <SettingSection
            icon={Key}
            title="API Configuration"
            description="Manage API connections"
          >
            <div className="p-4 rounded-lg bg-black/30 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <p className="text-sm text-white">NVIDIA API</p>
                  <p className="text-xs text-neutral-500">Connected and active</p>
                </div>
              </div>
            </div>
          </SettingSection>
        </div>

        <motion.div 
          className="mt-8 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 transition-all"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
