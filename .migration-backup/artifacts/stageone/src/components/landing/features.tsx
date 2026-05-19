import { motion } from "framer-motion"
import {
  BarChart3,
  Bot,
  Globe,
  Rocket,
  Workflow,
  Zap,
} from "lucide-react"

const features = [
  {
    icon: BarChart3,
    title: "Business Analysis",
    description:
      "Deep-dive into market positioning, competitive landscape, and revenue potential with AI-powered insights.",
  },
  {
    icon: Rocket,
    title: "Growth Strategy",
    description:
      "Generate actionable growth plans with customer acquisition strategies, retention tactics, and scaling roadmaps.",
  },
  {
    icon: Globe,
    title: "Website Structure",
    description:
      "Receive complete sitemap blueprints, page hierarchies, and content frameworks tailored to your business.",
  },
  {
    icon: Bot,
    title: "Chatbot Design",
    description:
      "Build intelligent conversational flows with predefined intents, responses, and escalation paths.",
  },
  {
    icon: Workflow,
    title: "Automation Plan",
    description:
      "Identify automation opportunities across operations with detailed implementation blueprints.",
  },
  {
    icon: Zap,
    title: "Instant Generation",
    description:
      "Get comprehensive business intelligence in seconds, not weeks. Ready to execute immediately.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
}

export function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="text-sm font-medium uppercase tracking-wider text-primary">
            Capabilities
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Everything You Need to Launch
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            STAGEONE combines multiple AI modules to deliver a complete business
            operating system in one platform.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="glass-card-hover group rounded-xl p-6"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
