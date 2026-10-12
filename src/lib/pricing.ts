// Central pricing config. All prices are annual, in KES.
export type Availability = "live" | "proposed" | "planned";

export type Feature = { text: string; availability?: Availability };

export type IndividualPlan = {
  id: "basic" | "guided" | "builder";
  name: string;
  price: number;
  headline: string;
  description: string;
  includesPrevious?: string;
  features: Feature[];
  cta: string;
  featured?: boolean;
};

export type TeamPackage = {
  id: "duo" | "studio" | "launch";
  name: string;
  price: number;
  members: number;
  projects: number;
  audience: string;
  description: string;
  features: string[];
};

export const individualPlans: IndividualPlan[] = [
  {
    id: "basic",
    name: "MetaTwin Basic",
    price: 2000,
    headline: "Build your professional story.",
    description: "Create a personal record of your skills, interests, projects, and achievements. Start documenting what you know and what you can do.",
    features: [
      { text: "Personal MetaTwin profile" },
      { text: "Skills and capabilities" },
      { text: "Interests and career aspirations" },
      { text: "Project portfolio and achievements" },
      { text: "Supporting evidence and external links" },
      { text: "Ability to update your profile as you grow" },
    ],
    cta: "Get Started",
  },
  {
    id: "guided",
    name: "MetaTwin Guided",
    price: 5000,
    headline: "Get guidance for your next step.",
    description: "Develop your ideas and projects with practical guidance from experienced business owners, industry professionals, and mentors.",
    includesPrevious: "Everything in Basic, plus:",
    features: [
      { text: "Four individual Builder Sessions per year, subject to mentor availability and booking rules", availability: "proposed" },
      { text: "Guidance on business ideas, student innovations, and personal projects" },
      { text: "Practical feedback on challenges and opportunities" },
      { text: "Help identifying priorities and next steps" },
    ],
    cta: "Explore Guided",
    featured: true,
  },
  {
    id: "builder",
    name: "MetaTwin Builder",
    price: 10000,
    headline: "Turn your goals into progress.",
    description: "Build a more structured development journey with tools to plan projects, track milestones, and document progress over time.",
    includesPrevious: "Everything in Guided, plus:",
    features: [
      { text: "Personal development and project calendar", availability: "planned" },
      { text: "Goal setting and milestone tracking", availability: "planned" },
      { text: "90-day planning templates", availability: "planned" },
      { text: "Project progress reviews", availability: "planned" },
      { text: "Tools for documenting progress and evidence", availability: "planned" },
    ],
    cta: "Choose Builder",
  },
];

export const teamPackages: TeamPackage[] = [
  {
    id: "duo",
    name: "Team Duo",
    price: 3500,
    members: 2,
    projects: 1,
    audience: "For two-person teams",
    description: "For co-founders, collaborators, and project partners who want to document what they're building together.",
    features: ["Two individual member profiles", "One shared team project record", "Project description and objectives", "Project deliverables and supporting links", "Individual roles and contribution records"],
  },
  {
    id: "studio",
    name: "Team Studio",
    price: 4800,
    members: 3,
    projects: 1,
    audience: "For three-person teams",
    description: "For student innovators and small project teams developing a shared idea or prototype.",
    features: ["Three individual member profiles", "One shared team project record", "Project goals and deliverables", "Project evidence and supporting links", "Individual roles and contribution records"],
  },
  {
    id: "launch",
    name: "Team Launch",
    price: 7000,
    members: 5,
    projects: 1,
    audience: "For five-person teams",
    description: "For university innovation teams, competition teams, student clubs, and early-stage ventures.",
    features: ["Five individual member profiles", "One shared team project record", "Project milestones and documentation", "Supporting evidence and deliverables", "Individual roles and contribution records"],
  },
];

export const comparisonRows: { feature: string; basic: string; guided: string; builder: string }[] = [
  { feature: "Personal profile", basic: "Included", guided: "Included", builder: "Included" },
  { feature: "Skills and capabilities", basic: "Included", guided: "Included", builder: "Included" },
  { feature: "Projects and supporting evidence", basic: "Included", guided: "Included", builder: "Included" },
  { feature: "Individual mentor sessions", basic: "Not included", guided: "Four per year, subject to availability", builder: "Same as Guided" },
  { feature: "Development calendar", basic: "Not included", guided: "Not included", builder: "Planned feature" },
  { feature: "Goal and milestone tracking", basic: "Not included", guided: "Not included", builder: "Planned feature" },
  { feature: "90-day planning tools", basic: "Not included", guided: "Not included", builder: "Planned feature" },
];

export const perMember = (p: TeamPackage) => Math.round(p.price / p.members);
export const formatKES = (n: number) => `KES ${n.toLocaleString("en-US")}`;

export const WHATSAPP_CONTACT_URL = "https://wa.me/254726227481";
export const WHATSAPP_CONTACT_DISPLAY = "+254 726 227 481";

// Team service levels. Prices are the confirmed table values from the brief (annual KES).
export type TeamTier = {
  id: "basic" | "guided" | "builder";
  name: string;
  prices: Record<TeamPackage["id"], number>;
  headline: string;
  description: string;
  includesPrevious?: string;
  features: Feature[];
  cta: string;
  featured?: boolean;
};

export const teamTiers: TeamTier[] = [
  {
    id: "basic",
    name: "Team Basic",
    prices: { duo: 3500, studio: 4800, launch: 7000 },
    headline: "Build something together.",
    description: "For student innovators, collaborators, co-founders, and project teams who want to document their work and make their individual contributions visible. Every member receives MetaTwin Basic access.",
    features: [
      { text: "Individual MetaTwin profile for every member" },
      { text: "One shared team project record" },
      { text: "Project description, objectives, and deliverables" },
      { text: "Supporting links and project evidence" },
      { text: "Individual roles and contribution records" },
      { text: "Each member's profile connected to the shared project", availability: "planned" },
    ],
    cta: "Start a Team",
  },
  {
    id: "guided",
    name: "Team Guided",
    prices: { duo: 8500, studio: 11800, launch: 17000 },
    headline: "Build together, with expert guidance.",
    description: "For teams that want practical mentoring to help move their project, innovation, or business idea forward.",
    includesPrevious: "Everything in Team Basic, plus",
    features: [
      { text: "Four group Builder Sessions per team per year", availability: "proposed" },
      { text: "Develop and refine your business or project idea" },
      { text: "Work through practical challenges and set priorities" },
      { text: "Feedback from experienced entrepreneurs and industry professionals" },
      { text: "An actionable plan for continued progress" },
    ],
    cta: "Choose Team Guided",
    featured: true,
  },
  {
    id: "builder",
    name: "Team Builder",
    prices: { duo: 16500, studio: 22800, launch: 32000 },
    headline: "Turn your shared ambition into measurable progress.",
    description: "For teams that want mentoring alongside a structured way to plan, manage, and document their development.",
    includesPrevious: "Everything in Team Guided, plus",
    features: [
      { text: "Shared: team project milestones", availability: "planned" },
      { text: "Shared: project planning calendar", availability: "planned" },
      { text: "Shared: project progress reviews", availability: "planned" },
      { text: "Shared: documentation of deliverables and achievements", availability: "planned" },
      { text: "Personal: goal setting and progress tracking", availability: "planned" },
      { text: "Personal: 90-day planning templates", availability: "planned" },
      { text: "Personal: development goals connected to team participation", availability: "planned" },
    ],
    cta: "Choose Team Builder",
  },
];

export const teamTierPrice = (pkg: TeamPackage, tier: TeamTier) => tier.prices[pkg.id];

export const teamPremium = (pkg: TeamPackage, tier: TeamTier) => teamTierPrice(pkg, tier) - pkg.price;
