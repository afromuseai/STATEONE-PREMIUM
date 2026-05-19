import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type Lang = "en" | "es" | "it" | "fr" | "pt"

export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
]

const translations = {
  en: {
    nav: {
      features: "Features",
      howItWorks: "How It Works",
      pricing: "Pricing",
      signIn: "Sign In",
      startBuilding: "Start Building",
      dashboard: "Dashboard",
    },
    hero: {
      badge: "AI Business Operating System",
      headline1: "The AI Operating System for",
      businessTypes: [
        "Modern Businesses.",
        "SaaS Startups.",
        "E-commerce Brands.",
        "Creative Agencies.",
        "Tech Founders.",
        "Service Companies.",
      ],
      subHeadline:
        "One platform to research, design, build, and operate your entire business using a coordinated swarm of autonomous AI agents. From idea to production in under 60 seconds.",
      ctaPrimary: "Start Building Your OS",
      ctaSecondary: "View Demo",
      metrics: {
        businessesBuilt: "Businesses Built",
        aiModels: "AI Models Active",
        avgLaunch: "Avg. Time to Launch",
        uptime: "Uptime SLA",
      },
      trustedBy: "Trusted by 2,400+ builders",
      noCreditCard: "No credit card required",
    },
    features: {
      badge: "Platform Capabilities",
      title: "The Complete AI Business OS",
      subtitle:
        "Every system you need to build, operate, and scale a modern business — orchestrated by AI, executed in real time.",
      items: [
        {
          title: "Business Intelligence",
          description:
            "Deep AI analysis of market positioning, competitive landscape, revenue potential, and growth vectors — delivered in seconds.",
          statLabel: "accuracy rate",
        },
        {
          title: "Website Architect",
          description:
            "Generate complete, production-ready websites with custom design, copywriting, and React component code. Export and deploy instantly.",
          statLabel: "generation time",
        },
        {
          title: "AI Execution Engine",
          description:
            "A persistent orchestration layer that plans, executes, and monitors complex business tasks across your entire operation.",
          statLabel: "parallel tasks",
        },
        {
          title: "Agent Systems",
          description:
            "12 pre-built autonomous agents across Sales, Support, Marketing, Research, and Operations — install and configure in one click.",
          statLabel: "ready agents",
        },
        {
          title: "AI Memory",
          description:
            "Persistent cross-session intelligence. STAGEONE learns your business context and injects it into every future AI interaction.",
          statLabel: "context retained",
        },
        {
          title: "Automation Builder",
          description:
            "Identify and implement automation opportunities across your operations with detailed workflow blueprints and execution plans.",
          statLabel: "time saved",
        },
      ],
    },
    howItWorks: {
      badge: "How It Works",
      title: "From Idea to Operating Business",
      subtitle: "Six stages. One session. A complete AI-powered business.",
      stages: ["Idea", "Intelligence", "Website", "Execution", "Deployment", "Memory"],
      steps: [
        {
          title: "Describe Your Vision",
          description:
            "Enter your business concept in natural language. Target market, goals, challenges — no forms or templates.",
          detail: "AI Memory injects your past context automatically.",
        },
        {
          title: "Intelligence Engine",
          description:
            "Deep market analysis, competitive positioning, revenue modeling, and strategic growth vectors — generated in real time.",
          detail: "Market data + AI reasoning = actionable intelligence.",
        },
        {
          title: "Website Generation",
          description:
            "Full production website with React components, custom design system, copywriting, and exportable code.",
          detail: "8 sections, complete design, ready to deploy.",
        },
        {
          title: "AI Orchestration",
          description:
            "Multi-agent pipeline executes complex business tasks in parallel — agents, automations, and workflows activate.",
          detail: "12 AI systems working in parallel — under 60 seconds.",
        },
        {
          title: "Deploy & Launch",
          description:
            "One-click deployment with staging environments, rollback support, and real-time uptime monitoring.",
          detail: "From idea to live product in one session.",
        },
        {
          title: "Memory & Scale",
          description:
            "STAGEONE learns your business context across sessions, continuously improving every AI interaction.",
          detail: "Persistent AI memory — smarter with every session.",
        },
      ],
    },
    cta: {
      badge: "Get Started",
      title: "Ready to Build Your",
      titleAccent: "AI-Powered Business?",
      subtitle:
        "Start free. Generate your first business intelligence report, website, and automation plan in under a minute — no credit card required.",
      ctaPrimary: "Start Building",
      ctaSecondary: "View Pricing",
      microcopy: ["No credit card", "Free to start", "Cancel anytime"],
    },
    footer: {
      tagline: "The AI Business Operating System for modern operators.",
      platform: "Platform",
      tools: "Tools",
      account: "Account",
      features: "Features",
      howItWorks: "How It Works",
      pricing: "Pricing",
      dashboard: "Dashboard",
      businessIntelligence: "Business Intelligence",
      websiteArchitect: "Website Architect",
      aiAgents: "AI Agents",
      developerApi: "Developer API",
      signIn: "Sign In",
      createAccount: "Create Account",
      settings: "Settings",
      rights: "All rights reserved.",
      builtWith: "Built with multi-model AI infrastructure.",
    },
    dashboard: {
      sections: {
        generate: "Generate",
        orchestrate: "Orchestrate",
        manage: "Manage",
      },
      nav: {
        dashboard: "Dashboard",
        businessIntelligence: "Business Intelligence",
        websiteGenerator: "Website Generator",
        aiChatbot: "AI Chatbot Generator",
        automationBuilder: "Automation Builder",
        aiOrchestrator: "AI Orchestrator",
        projects: "Projects",
        settings: "Settings",
        adminPanel: "Admin Panel",
      },
      actions: {
        newAnalysis: "New Analysis",
        search: "Search or jump to...",
        signOut: "Sign out",
        searchShortcut: "Quick Navigation",
      },
    },
  },
  es: {
    nav: {
      features: "Funciones",
      howItWorks: "Cómo Funciona",
      pricing: "Precios",
      signIn: "Iniciar Sesión",
      startBuilding: "Empieza Ahora",
      dashboard: "Panel",
    },
    hero: {
      badge: "Sistema Operativo de Negocios con IA",
      headline1: "El Sistema Operativo IA para",
      businessTypes: [
        "Negocios Modernos.",
        "Startups SaaS.",
        "Marcas de E-commerce.",
        "Agencias Creativas.",
        "Fundadores Tech.",
        "Empresas de Servicios.",
      ],
      subHeadline:
        "Una plataforma para investigar, diseñar, construir y operar todo tu negocio usando una red coordinada de agentes IA autónomos. De la idea a producción en menos de 60 segundos.",
      ctaPrimary: "Comienza a Construir tu OS",
      ctaSecondary: "Ver Demo",
      metrics: {
        businessesBuilt: "Negocios Creados",
        aiModels: "Modelos IA Activos",
        avgLaunch: "Tiempo de Lanzamiento",
        uptime: "Disponibilidad SLA",
      },
      trustedBy: "Confiado por más de 2.400 creadores",
      noCreditCard: "Sin tarjeta de crédito",
    },
    features: {
      badge: "Capacidades de la Plataforma",
      title: "El OS de Negocios con IA Completo",
      subtitle:
        "Todos los sistemas que necesitas para construir, operar y escalar un negocio moderno — orquestado por IA, ejecutado en tiempo real.",
      items: [
        {
          title: "Inteligencia de Negocios",
          description:
            "Análisis profundo de posicionamiento de mercado, panorama competitivo, potencial de ingresos y vectores de crecimiento — en segundos.",
          statLabel: "tasa de precisión",
        },
        {
          title: "Arquitecto Web",
          description:
            "Genera sitios web completos y listos para producción con diseño personalizado, redacción y código React. Exporta y despliega al instante.",
          statLabel: "tiempo de generación",
        },
        {
          title: "Motor de Ejecución IA",
          description:
            "Una capa de orquestación persistente que planifica, ejecuta y supervisa tareas empresariales complejas en toda tu operación.",
          statLabel: "tareas paralelas",
        },
        {
          title: "Sistemas de Agentes",
          description:
            "12 agentes autónomos preconfigurados en Ventas, Soporte, Marketing, Investigación y Operaciones — instala y configura con un clic.",
          statLabel: "agentes listos",
        },
        {
          title: "Memoria IA",
          description:
            "Inteligencia persistente entre sesiones. STAGEONE aprende el contexto de tu negocio e inyecta esto en cada interacción futura.",
          statLabel: "contexto retenido",
        },
        {
          title: "Constructor de Automatización",
          description:
            "Identifica e implementa oportunidades de automatización en tus operaciones con planos de flujo de trabajo y planes de ejecución detallados.",
          statLabel: "tiempo ahorrado",
        },
      ],
    },
    howItWorks: {
      badge: "Cómo Funciona",
      title: "De la Idea al Negocio Operativo",
      subtitle: "Seis etapas. Una sesión. Un negocio completo impulsado por IA.",
      stages: ["Idea", "Inteligencia", "Web", "Ejecución", "Despliegue", "Memoria"],
      steps: [
        {
          title: "Describe tu Visión",
          description:
            "Ingresa tu concepto de negocio en lenguaje natural. Mercado objetivo, metas, desafíos — sin formularios ni plantillas.",
          detail: "La Memoria IA inyecta tu contexto pasado automáticamente.",
        },
        {
          title: "Motor de Inteligencia",
          description:
            "Análisis profundo de mercado, posicionamiento competitivo, modelado de ingresos y vectores de crecimiento estratégico — en tiempo real.",
          detail: "Datos de mercado + razonamiento IA = inteligencia accionable.",
        },
        {
          title: "Generación de Sitio Web",
          description:
            "Sitio web completo de producción con componentes React, sistema de diseño personalizado, redacción y código exportable.",
          detail: "8 secciones, diseño completo, listo para desplegar.",
        },
        {
          title: "Orquestación IA",
          description:
            "El pipeline multi-agente ejecuta tareas empresariales complejas en paralelo — agentes, automatizaciones y flujos de trabajo se activan.",
          detail: "12 sistemas IA trabajando en paralelo — en menos de 60 segundos.",
        },
        {
          title: "Despliegue y Lanzamiento",
          description:
            "Despliegue con un clic con entornos de staging, soporte de rollback y monitoreo de disponibilidad en tiempo real.",
          detail: "De la idea al producto en vivo en una sesión.",
        },
        {
          title: "Memoria y Escala",
          description:
            "STAGEONE aprende el contexto de tu negocio entre sesiones, mejorando continuamente cada interacción con IA.",
          detail: "Memoria IA persistente — más inteligente con cada sesión.",
        },
      ],
    },
    cta: {
      badge: "Comenzar",
      title: "¿Listo para Construir tu",
      titleAccent: "Negocio con IA?",
      subtitle:
        "Empieza gratis. Genera tu primer informe de inteligencia de negocios, sitio web y plan de automatización en menos de un minuto — sin tarjeta de crédito.",
      ctaPrimary: "Empieza a Construir",
      ctaSecondary: "Ver Precios",
      microcopy: ["Sin tarjeta de crédito", "Gratis para empezar", "Cancela en cualquier momento"],
    },
    footer: {
      tagline: "El Sistema Operativo de Negocios IA para operadores modernos.",
      platform: "Plataforma",
      tools: "Herramientas",
      account: "Cuenta",
      features: "Funciones",
      howItWorks: "Cómo Funciona",
      pricing: "Precios",
      dashboard: "Panel",
      businessIntelligence: "Inteligencia de Negocios",
      websiteArchitect: "Arquitecto Web",
      aiAgents: "Agentes IA",
      developerApi: "API para Desarrolladores",
      signIn: "Iniciar Sesión",
      createAccount: "Crear Cuenta",
      settings: "Configuración",
      rights: "Todos los derechos reservados.",
      builtWith: "Construido con infraestructura IA multi-modelo.",
    },
    dashboard: {
      sections: {
        generate: "Generar",
        orchestrate: "Orquestar",
        manage: "Gestionar",
      },
      nav: {
        dashboard: "Panel",
        businessIntelligence: "Inteligencia de Negocios",
        websiteGenerator: "Generador Web",
        aiChatbot: "Chatbot IA",
        automationBuilder: "Constructor de Automatización",
        aiOrchestrator: "Orquestador IA",
        projects: "Proyectos",
        settings: "Configuración",
        adminPanel: "Panel Admin",
      },
      actions: {
        newAnalysis: "Nuevo Análisis",
        search: "Buscar o ir a...",
        signOut: "Cerrar sesión",
        searchShortcut: "Navegación Rápida",
      },
    },
  },
  it: {
    nav: {
      features: "Funzionalità",
      howItWorks: "Come Funziona",
      pricing: "Prezzi",
      signIn: "Accedi",
      startBuilding: "Inizia a Costruire",
      dashboard: "Dashboard",
    },
    hero: {
      badge: "Sistema Operativo Aziendale AI",
      headline1: "Il Sistema Operativo AI per",
      businessTypes: [
        "Aziende Moderne.",
        "Startup SaaS.",
        "Brand E-commerce.",
        "Agenzie Creative.",
        "Fondatori Tech.",
        "Aziende di Servizi.",
      ],
      subHeadline:
        "Un'unica piattaforma per ricercare, progettare, costruire e gestire tutta la tua azienda usando uno sciame coordinato di agenti AI autonomi. Dall'idea alla produzione in meno di 60 secondi.",
      ctaPrimary: "Inizia a Costruire il tuo OS",
      ctaSecondary: "Guarda la Demo",
      metrics: {
        businessesBuilt: "Aziende Create",
        aiModels: "Modelli AI Attivi",
        avgLaunch: "Tempo di Lancio Medio",
        uptime: "SLA di Uptime",
      },
      trustedBy: "Scelto da oltre 2.400 costruttori",
      noCreditCard: "Nessuna carta di credito richiesta",
    },
    features: {
      badge: "Capacità della Piattaforma",
      title: "Il Sistema Operativo AI Aziendale Completo",
      subtitle:
        "Tutti i sistemi necessari per costruire, operare e scalare un'azienda moderna — orchestrati dall'AI, eseguiti in tempo reale.",
      items: [
        {
          title: "Business Intelligence",
          description:
            "Analisi AI approfondita del posizionamento di mercato, panorama competitivo, potenziale di ricavi e vettori di crescita — in pochi secondi.",
          statLabel: "tasso di precisione",
        },
        {
          title: "Architetto Web",
          description:
            "Genera siti web completi e pronti per la produzione con design personalizzato, copywriting e codice React. Esporta e distribuisci istantaneamente.",
          statLabel: "tempo di generazione",
        },
        {
          title: "Motore di Esecuzione AI",
          description:
            "Uno strato di orchestrazione persistente che pianifica, esegue e monitora attività aziendali complesse in tutta la tua operazione.",
          statLabel: "attività parallele",
        },
        {
          title: "Sistemi di Agenti",
          description:
            "12 agenti autonomi preconfigurati in Vendite, Supporto, Marketing, Ricerca e Operazioni — installa e configura con un clic.",
          statLabel: "agenti pronti",
        },
        {
          title: "Memoria AI",
          description:
            "Intelligenza persistente tra sessioni. STAGEONE apprende il contesto della tua azienda e lo inietta in ogni futura interazione AI.",
          statLabel: "contesto conservato",
        },
        {
          title: "Costruttore di Automazione",
          description:
            "Identifica e implementa opportunità di automazione nelle tue operazioni con blueprint dettagliati di flusso di lavoro e piani di esecuzione.",
          statLabel: "tempo risparmiato",
        },
      ],
    },
    howItWorks: {
      badge: "Come Funziona",
      title: "Dall'Idea all'Azienda Operativa",
      subtitle: "Sei fasi. Una sessione. Un'azienda completa alimentata dall'AI.",
      stages: ["Idea", "Intelligenza", "Sito Web", "Esecuzione", "Deploy", "Memoria"],
      steps: [
        {
          title: "Descrivi la Tua Visione",
          description:
            "Inserisci il tuo concetto di business in linguaggio naturale. Mercato target, obiettivi, sfide — nessun modulo o template.",
          detail: "La Memoria AI inietta automaticamente il tuo contesto passato.",
        },
        {
          title: "Motore di Intelligenza",
          description:
            "Analisi di mercato approfondita, posizionamento competitivo, modellazione dei ricavi e vettori di crescita strategici — in tempo reale.",
          detail: "Dati di mercato + ragionamento AI = intelligenza pratica.",
        },
        {
          title: "Generazione del Sito Web",
          description:
            "Sito web di produzione completo con componenti React, sistema di design personalizzato, copywriting e codice esportabile.",
          detail: "8 sezioni, design completo, pronto per il deploy.",
        },
        {
          title: "Orchestrazione AI",
          description:
            "La pipeline multi-agente esegue attività aziendali complesse in parallelo — agenti, automazioni e flussi di lavoro si attivano.",
          detail: "12 sistemi AI in parallelo — in meno di 60 secondi.",
        },
        {
          title: "Deploy e Lancio",
          description:
            "Deploy con un clic con ambienti di staging, supporto rollback e monitoraggio uptime in tempo reale.",
          detail: "Dall'idea al prodotto live in una sessione.",
        },
        {
          title: "Memoria e Scala",
          description:
            "STAGEONE apprende il contesto della tua azienda tra le sessioni, migliorando continuamente ogni interazione AI.",
          detail: "Memoria AI persistente — più intelligente ad ogni sessione.",
        },
      ],
    },
    cta: {
      badge: "Inizia",
      title: "Pronto a Costruire la tua",
      titleAccent: "Azienda con AI?",
      subtitle:
        "Inizia gratis. Genera il tuo primo report di business intelligence, sito web e piano di automazione in meno di un minuto — nessuna carta di credito richiesta.",
      ctaPrimary: "Inizia a Costruire",
      ctaSecondary: "Vedi i Prezzi",
      microcopy: ["Nessuna carta di credito", "Gratis per iniziare", "Cancella in qualsiasi momento"],
    },
    footer: {
      tagline: "Il Sistema Operativo Aziendale AI per operatori moderni.",
      platform: "Piattaforma",
      tools: "Strumenti",
      account: "Account",
      features: "Funzionalità",
      howItWorks: "Come Funziona",
      pricing: "Prezzi",
      dashboard: "Dashboard",
      businessIntelligence: "Business Intelligence",
      websiteArchitect: "Architetto Web",
      aiAgents: "Agenti AI",
      developerApi: "API per Sviluppatori",
      signIn: "Accedi",
      createAccount: "Crea Account",
      settings: "Impostazioni",
      rights: "Tutti i diritti riservati.",
      builtWith: "Costruito con infrastruttura AI multi-modello.",
    },
    dashboard: {
      sections: {
        generate: "Genera",
        orchestrate: "Orchestra",
        manage: "Gestisci",
      },
      nav: {
        dashboard: "Dashboard",
        businessIntelligence: "Business Intelligence",
        websiteGenerator: "Generatore Web",
        aiChatbot: "Chatbot AI",
        automationBuilder: "Costruttore Automazione",
        aiOrchestrator: "Orchestratore AI",
        projects: "Progetti",
        settings: "Impostazioni",
        adminPanel: "Pannello Admin",
      },
      actions: {
        newAnalysis: "Nuova Analisi",
        search: "Cerca o vai a...",
        signOut: "Esci",
        searchShortcut: "Navigazione Rapida",
      },
    },
  },
  fr: {
    nav: {
      features: "Fonctionnalités",
      howItWorks: "Comment ça Marche",
      pricing: "Tarifs",
      signIn: "Se Connecter",
      startBuilding: "Commencer",
      dashboard: "Tableau de Bord",
    },
    hero: {
      badge: "Système d'Exploitation d'Entreprise IA",
      headline1: "Le Système d'Exploitation IA pour",
      businessTypes: [
        "Les Entreprises Modernes.",
        "Les Startups SaaS.",
        "Les Marques E-commerce.",
        "Les Agences Créatives.",
        "Les Fondateurs Tech.",
        "Les Sociétés de Services.",
      ],
      subHeadline:
        "Une plateforme pour rechercher, concevoir, créer et gérer toute votre entreprise grâce à un essaim coordonné d'agents IA autonomes. De l'idée à la production en moins de 60 secondes.",
      ctaPrimary: "Construisez votre OS",
      ctaSecondary: "Voir la Démo",
      metrics: {
        businessesBuilt: "Entreprises Créées",
        aiModels: "Modèles IA Actifs",
        avgLaunch: "Temps de Lancement",
        uptime: "SLA de Disponibilité",
      },
      trustedBy: "Approuvé par plus de 2 400 créateurs",
      noCreditCard: "Sans carte de crédit",
    },
    features: {
      badge: "Capacités de la Plateforme",
      title: "L'OS d'Entreprise IA Complet",
      subtitle:
        "Tous les systèmes dont vous avez besoin pour créer, exploiter et faire évoluer une entreprise moderne — orchestrés par l'IA, exécutés en temps réel.",
      items: [
        {
          title: "Intelligence d'Affaires",
          description:
            "Analyse IA approfondie du positionnement marché, du paysage concurrentiel, du potentiel de revenus et des vecteurs de croissance — en quelques secondes.",
          statLabel: "taux de précision",
        },
        {
          title: "Architecte Web",
          description:
            "Générez des sites web complets et prêts pour la production avec design personnalisé, rédaction et code React. Exportez et déployez instantanément.",
          statLabel: "temps de génération",
        },
        {
          title: "Moteur d'Exécution IA",
          description:
            "Une couche d'orchestration persistante qui planifie, exécute et surveille des tâches commerciales complexes dans toute votre organisation.",
          statLabel: "tâches parallèles",
        },
        {
          title: "Systèmes d'Agents",
          description:
            "12 agents autonomes préconfigurés dans les Ventes, le Support, le Marketing, la Recherche et les Opérations — installez et configurez en un clic.",
          statLabel: "agents prêts",
        },
        {
          title: "Mémoire IA",
          description:
            "Intelligence persistante entre les sessions. STAGEONE apprend le contexte de votre entreprise et l'injecte dans chaque future interaction IA.",
          statLabel: "contexte conservé",
        },
        {
          title: "Constructeur d'Automatisation",
          description:
            "Identifiez et implémentez des opportunités d'automatisation dans vos opérations avec des blueprints de flux de travail détaillés.",
          statLabel: "temps économisé",
        },
      ],
    },
    howItWorks: {
      badge: "Comment ça Marche",
      title: "De l'Idée à l'Entreprise Opérationnelle",
      subtitle: "Six étapes. Une session. Une entreprise complète alimentée par l'IA.",
      stages: ["Idée", "Intelligence", "Site Web", "Exécution", "Déploiement", "Mémoire"],
      steps: [
        {
          title: "Décrivez Votre Vision",
          description:
            "Entrez votre concept d'entreprise en langage naturel. Marché cible, objectifs, défis — sans formulaires ni modèles.",
          detail: "La Mémoire IA injecte automatiquement votre contexte passé.",
        },
        {
          title: "Moteur d'Intelligence",
          description:
            "Analyse de marché approfondie, positionnement concurrentiel, modélisation des revenus et vecteurs de croissance stratégiques — en temps réel.",
          detail: "Données de marché + raisonnement IA = intelligence actionnable.",
        },
        {
          title: "Génération de Site Web",
          description:
            "Site web de production complet avec composants React, système de design personnalisé, rédaction et code exportable.",
          detail: "8 sections, design complet, prêt à déployer.",
        },
        {
          title: "Orchestration IA",
          description:
            "Le pipeline multi-agents exécute des tâches commerciales complexes en parallèle — agents, automatisations et flux de travail s'activent.",
          detail: "12 systèmes IA en parallèle — en moins de 60 secondes.",
        },
        {
          title: "Déployer et Lancer",
          description:
            "Déploiement en un clic avec environnements de staging, support de rollback et surveillance de disponibilité en temps réel.",
          detail: "De l'idée au produit en ligne en une session.",
        },
        {
          title: "Mémoire et Échelle",
          description:
            "STAGEONE apprend le contexte de votre entreprise entre les sessions, améliorant continuellement chaque interaction IA.",
          detail: "Mémoire IA persistante — plus intelligente à chaque session.",
        },
      ],
    },
    cta: {
      badge: "Commencer",
      title: "Prêt à Construire votre",
      titleAccent: "Entreprise Alimentée par l'IA ?",
      subtitle:
        "Commencez gratuitement. Générez votre premier rapport de business intelligence, site web et plan d'automatisation en moins d'une minute — sans carte de crédit.",
      ctaPrimary: "Commencer à Construire",
      ctaSecondary: "Voir les Tarifs",
      microcopy: ["Sans carte de crédit", "Gratuit pour commencer", "Annulez à tout moment"],
    },
    footer: {
      tagline: "Le Système d'Exploitation d'Entreprise IA pour les opérateurs modernes.",
      platform: "Plateforme",
      tools: "Outils",
      account: "Compte",
      features: "Fonctionnalités",
      howItWorks: "Comment ça Marche",
      pricing: "Tarifs",
      dashboard: "Tableau de Bord",
      businessIntelligence: "Intelligence d'Affaires",
      websiteArchitect: "Architecte Web",
      aiAgents: "Agents IA",
      developerApi: "API Développeur",
      signIn: "Se Connecter",
      createAccount: "Créer un Compte",
      settings: "Paramètres",
      rights: "Tous droits réservés.",
      builtWith: "Construit avec une infrastructure IA multi-modèles.",
    },
    dashboard: {
      sections: {
        generate: "Générer",
        orchestrate: "Orchestrer",
        manage: "Gérer",
      },
      nav: {
        dashboard: "Tableau de Bord",
        businessIntelligence: "Intelligence d'Affaires",
        websiteGenerator: "Générateur Web",
        aiChatbot: "Chatbot IA",
        automationBuilder: "Constructeur d'Automatisation",
        aiOrchestrator: "Orchestrateur IA",
        projects: "Projets",
        settings: "Paramètres",
        adminPanel: "Panneau Admin",
      },
      actions: {
        newAnalysis: "Nouvelle Analyse",
        search: "Rechercher ou accéder à...",
        signOut: "Se déconnecter",
        searchShortcut: "Navigation Rapide",
      },
    },
  },
  pt: {
    nav: {
      features: "Funcionalidades",
      howItWorks: "Como Funciona",
      pricing: "Preços",
      signIn: "Entrar",
      startBuilding: "Comece Agora",
      dashboard: "Painel",
    },
    hero: {
      badge: "Sistema Operacional de Negócios com IA",
      headline1: "O Sistema Operacional de IA para",
      businessTypes: [
        "Negócios Modernos.",
        "Startups SaaS.",
        "Marcas de E-commerce.",
        "Agências Criativas.",
        "Fundadores de Tech.",
        "Empresas de Serviços.",
      ],
      subHeadline:
        "Uma plataforma para pesquisar, projetar, construir e operar todo o seu negócio usando um enxame coordenado de agentes de IA autônomos. Da ideia à produção em menos de 60 segundos.",
      ctaPrimary: "Comece a Construir seu OS",
      ctaSecondary: "Ver Demo",
      metrics: {
        businessesBuilt: "Negócios Criados",
        aiModels: "Modelos de IA Ativos",
        avgLaunch: "Tempo Médio de Lançamento",
        uptime: "SLA de Disponibilidade",
      },
      trustedBy: "Confiado por mais de 2.400 criadores",
      noCreditCard: "Sem cartão de crédito necessário",
    },
    features: {
      badge: "Capacidades da Plataforma",
      title: "O Sistema Operacional de IA Empresarial Completo",
      subtitle:
        "Todos os sistemas que você precisa para construir, operar e escalar um negócio moderno — orquestrado por IA, executado em tempo real.",
      items: [
        {
          title: "Inteligência de Negócios",
          description:
            "Análise profunda de IA sobre posicionamento de mercado, panorama competitivo, potencial de receita e vetores de crescimento — entregue em segundos.",
          statLabel: "taxa de precisão",
        },
        {
          title: "Arquiteto Web",
          description:
            "Gere sites completos e prontos para produção com design personalizado, copywriting e código React. Exporte e implante instantaneamente.",
          statLabel: "tempo de geração",
        },
        {
          title: "Motor de Execução de IA",
          description:
            "Uma camada de orquestração persistente que planeja, executa e monitora tarefas empresariais complexas em toda a sua operação.",
          statLabel: "tarefas paralelas",
        },
        {
          title: "Sistemas de Agentes",
          description:
            "12 agentes autônomos pré-configurados em Vendas, Suporte, Marketing, Pesquisa e Operações — instale e configure com um clique.",
          statLabel: "agentes prontos",
        },
        {
          title: "Memória de IA",
          description:
            "Inteligência persistente entre sessões. O STAGEONE aprende o contexto do seu negócio e o injeta em cada futura interação de IA.",
          statLabel: "contexto retido",
        },
        {
          title: "Construtor de Automação",
          description:
            "Identifique e implemente oportunidades de automação em suas operações com blueprints detalhados de fluxo de trabalho e planos de execução.",
          statLabel: "tempo economizado",
        },
      ],
    },
    howItWorks: {
      badge: "Como Funciona",
      title: "Da Ideia ao Negócio em Operação",
      subtitle: "Seis etapas. Uma sessão. Um negócio completo alimentado por IA.",
      stages: ["Ideia", "Inteligência", "Site", "Execução", "Deploy", "Memória"],
      steps: [
        {
          title: "Descreva sua Visão",
          description:
            "Insira seu conceito de negócio em linguagem natural. Mercado-alvo, metas, desafios — sem formulários ou modelos.",
          detail: "A Memória de IA injeta seu contexto passado automaticamente.",
        },
        {
          title: "Motor de Inteligência",
          description:
            "Análise profunda de mercado, posicionamento competitivo, modelagem de receita e vetores de crescimento estratégico — em tempo real.",
          detail: "Dados de mercado + raciocínio de IA = inteligência acionável.",
        },
        {
          title: "Geração de Site Web",
          description:
            "Site de produção completo com componentes React, sistema de design personalizado, copywriting e código exportável.",
          detail: "8 seções, design completo, pronto para implantar.",
        },
        {
          title: "Orquestração de IA",
          description:
            "O pipeline multi-agente executa tarefas empresariais complexas em paralelo — agentes, automações e fluxos de trabalho são ativados.",
          detail: "12 sistemas de IA em paralelo — em menos de 60 segundos.",
        },
        {
          title: "Deploy e Lançamento",
          description:
            "Deploy com um clique com ambientes de staging, suporte a rollback e monitoramento de disponibilidade em tempo real.",
          detail: "Da ideia ao produto ao vivo em uma sessão.",
        },
        {
          title: "Memória e Escala",
          description:
            "O STAGEONE aprende o contexto do seu negócio entre sessões, melhorando continuamente cada interação de IA.",
          detail: "Memória de IA persistente — mais inteligente a cada sessão.",
        },
      ],
    },
    cta: {
      badge: "Começar",
      title: "Pronto para Construir seu",
      titleAccent: "Negócio com IA?",
      subtitle:
        "Comece gratuitamente. Gere seu primeiro relatório de inteligência de negócios, site e plano de automação em menos de um minuto — sem cartão de crédito.",
      ctaPrimary: "Comece a Construir",
      ctaSecondary: "Ver Preços",
      microcopy: ["Sem cartão de crédito", "Grátis para começar", "Cancele a qualquer momento"],
    },
    footer: {
      tagline: "O Sistema Operacional de Negócios com IA para operadores modernos.",
      platform: "Plataforma",
      tools: "Ferramentas",
      account: "Conta",
      features: "Funcionalidades",
      howItWorks: "Como Funciona",
      pricing: "Preços",
      dashboard: "Painel",
      businessIntelligence: "Inteligência de Negócios",
      websiteArchitect: "Arquiteto Web",
      aiAgents: "Agentes de IA",
      developerApi: "API para Desenvolvedores",
      signIn: "Entrar",
      createAccount: "Criar Conta",
      settings: "Configurações",
      rights: "Todos os direitos reservados.",
      builtWith: "Construído com infraestrutura de IA multi-modelo.",
    },
    dashboard: {
      sections: {
        generate: "Gerar",
        orchestrate: "Orquestrar",
        manage: "Gerenciar",
      },
      nav: {
        dashboard: "Painel",
        businessIntelligence: "Inteligência de Negócios",
        websiteGenerator: "Gerador de Site",
        aiChatbot: "Chatbot de IA",
        automationBuilder: "Construtor de Automação",
        aiOrchestrator: "Orquestrador de IA",
        projects: "Projetos",
        settings: "Configurações",
        adminPanel: "Painel Admin",
      },
      actions: {
        newAnalysis: "Nova Análise",
        search: "Pesquisar ou ir para...",
        signOut: "Sair",
        searchShortcut: "Navegação Rápida",
      },
    },
  },
} as const

type Translations = typeof translations
type LangTranslations = Translations["en"]

interface LangContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: LangTranslations
}

const LangContext = createContext<LangContextValue | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem("stageone-lang") as Lang | null
    return stored && stored in translations ? stored : "en"
  })

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem("stageone-lang", l)
  }

  const t = translations[lang] as unknown as LangTranslations

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error("useLang must be used inside LangProvider")
  return ctx
}
