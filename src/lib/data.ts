// Sample/demo content for the marketing and preview pages (home, profile,
// projects, capability detail, journey, dashboard). Explicitly fictional —
// every page that reads from this file carries a "Prototype" / "Fictional
// sample data" label. Wiring these pages to the real schema (twins, skills,
// competencies, courses, projects, assessments, opportunities, matches) is
// tracked as follow-up work in .claude/PROJECT_STATE.md.
export type Status = "self" | "evidence" | "reviewed";

export const statusMeta: Record<Status, { label: string; desc: string }> = {
  self: { label: "Self-Reported", desc: "The individual states they have this capability." },
  evidence: { label: "Evidence Added", desc: "Supporting work has been attached." },
  reviewed: { label: "Reviewed", desc: "An identified reviewer has examined the specified evidence." },
};

export type Capability = {
  slug: string;
  name: string;
  group: "Technical" | "Creative" | "Problem-solving" | "Collaboration" | "Domain";
  status: Status;
  summary: string;
  evidence: { type: string; title: string; note: string }[];
  review?: { reviewer: string; role: string; scope: string; quote: string; date: string };
  projects: string[];
};

export const capabilities: Capability[] = [
  {
    slug: "3d-modelling",
    name: "3D Modelling",
    group: "Technical",
    status: "reviewed",
    summary: "Parametric and surface modelling for product prototypes, from sketch to print-ready files.",
    evidence: [
      { type: "Model", title: "Modular water filter housing (v3)", note: "Fusion 360 file, 14 components, tolerances documented." },
      { type: "Documentation", title: "Design rationale & iteration log", note: "8-page PDF covering three revisions." },
      { type: "Renders", title: "Rendered images set", note: "6 KeyShot renders, exploded and in-use views." },
      { type: "Contribution", title: "Statement of contribution", note: "Sole modeller; housing and clip mechanism designed individually." },
    ],
    review: {
      reviewer: "Dr. Imani Wekesa",
      role: "Industrial Design Lecturer",
      scope: "Reviewed the v3 model files and iteration log only.",
      quote: "Clear progression between revisions. Tolerancing on the clip mechanism is considered and well documented.",
      date: "14 Aug 2026",
    },
    projects: ["aqualoop-filter", "campus-wayfinding"],
  },
  {
    slug: "react-development",
    name: "React App Development",
    group: "Technical",
    status: "evidence",
    summary: "Building accessible, data-driven web interfaces with React and TypeScript.",
    evidence: [
      { type: "Repository", title: "FieldNote source code", note: "Public repo, 212 commits, test coverage report." },
      { type: "Demo", title: "Recorded prototype walkthrough", note: "4-minute screen recording of core flows." },
    ],
    projects: ["fieldnote-app"],
  },
  {
    slug: "user-research",
    name: "User Research",
    group: "Problem-solving",
    status: "reviewed",
    summary: "Planning and running interviews, synthesising findings into design decisions.",
    evidence: [
      { type: "Report", title: "Market vendor interview synthesis", note: "12 interviews, affinity map, 5 key insights." },
      { type: "Presentation", title: "Findings deck", note: "Presented to cooperative board, March 2026." },
    ],
    review: {
      reviewer: "Samuel Otieno",
      role: "Programme Lead, Ukulima Co-op",
      scope: "Reviewed the interview synthesis and attended the presentation.",
      quote: "The insights changed how we prioritised the pilot. Methodology was transparent.",
      date: "22 Mar 2026",
    },
    projects: ["market-ledger", "fieldnote-app"],
  },
  {
    slug: "visual-design",
    name: "Visual & Interface Design",
    group: "Creative",
    status: "evidence",
    summary: "Interface systems, typography and visual storytelling for digital products.",
    evidence: [
      { type: "Work sample", title: "FieldNote design system", note: "Figma library: 48 components, tokens documented." },
      { type: "Work sample", title: "Wayfinding signage concepts", note: "12 sign layouts with legibility testing notes." },
    ],
    projects: ["fieldnote-app", "campus-wayfinding"],
  },
  {
    slug: "systems-thinking",
    name: "Systems Thinking",
    group: "Problem-solving",
    status: "evidence",
    summary: "Mapping stakeholders and feedback loops before committing to a solution.",
    evidence: [{ type: "Diagram", title: "Water reuse system map", note: "Stakeholder and material flows for a 40-unit residence." }],
    projects: ["aqualoop-filter"],
  },
  {
    slug: "team-facilitation",
    name: "Team Facilitation",
    group: "Collaboration",
    status: "self",
    summary: "Running design sprints and keeping cross-disciplinary teams aligned.",
    evidence: [],
    projects: ["market-ledger"],
  },
  {
    slug: "technical-writing",
    name: "Technical Writing",
    group: "Collaboration",
    status: "evidence",
    summary: "Clear documentation for engineers, users and non-technical stakeholders.",
    evidence: [{ type: "Document", title: "AquaLoop assembly guide", note: "Illustrated guide used in two workshops." }],
    projects: ["aqualoop-filter"],
  },
  {
    slug: "sustainable-materials",
    name: "Sustainable Materials",
    group: "Domain",
    status: "self",
    summary: "Working knowledge of recycled polymers and low-impact fabrication.",
    evidence: [],
    projects: ["aqualoop-filter"],
  },
];

export type Stage = "Idea" | "In Progress" | "Prototype" | "Completed";
export type Discipline =
  | "3D Design"
  | "Software"
  | "Business Innovation"
  | "Engineering"
  | "Sustainability"
  | "Creative Problem-Solving";

export type Project = {
  id: string;
  title: string;
  description: string;
  discipline: Discipline;
  stage: Stage;
  team: { type: "Individual" | "Team"; size: number; myRole: string; collective?: string };
  capabilities: string[];
  evidenceCount: number;
  problem: string;
  solution: string;
  samples: { title: string; kind: string }[];
  feedback: { from: string; role: string; text: string; date: string }[];
  iterations: { version: string; change: string }[];
  outcome: string;
  next: string;
  journey: { step: string; date: string; text: string; material?: string }[];
};

export const projects: Project[] = [
  {
    id: "aqualoop-filter",
    title: "AquaLoop Greywater Filter",
    description: "A modular, printable filter housing that lets small residences reuse sink water for gardens.",
    discipline: "3D Design",
    stage: "Prototype",
    team: { type: "Team", size: 3, myRole: "Lead 3D modeller — designed the housing, clip mechanism and all printable parts.", collective: "Team delivered filtration testing, user workshops and a costed pilot plan." },
    capabilities: ["3d-modelling", "systems-thinking", "technical-writing", "sustainable-materials"],
    evidenceCount: 9,
    problem: "Student residences discard thousands of litres of lightly used sink water each week while gardens are watered from mains supply.",
    solution: "A three-stage filter in a modular housing that can be printed locally, assembled without tools and serviced in under five minutes.",
    samples: [
      { title: "Housing v3 — Fusion 360", kind: "3D model" },
      { title: "Exploded render set", kind: "Images" },
      { title: "Assembly guide", kind: "PDF" },
      { title: "Flow test results", kind: "Spreadsheet" },
    ],
    feedback: [
      { from: "Dr. Imani Wekesa", role: "Industrial Design Lecturer", text: "Clip mechanism is the strongest part. Reconsider wall thickness for UV exposure.", date: "02 Jul 2026" },
      { from: "Residence facilities team", role: "End users", text: "Servicing took 4 minutes in our trial — faster than expected.", date: "30 Jul 2026" },
    ],
    iterations: [
      { version: "v1", change: "Single-body housing; difficult to print and clean." },
      { version: "v2", change: "Split into 4 modules; added snap-fit clips." },
      { version: "v3", change: "Thicker UV-resistant walls after feedback; 18% less material." },
    ],
    outcome: "Two prototypes installed in a residence pilot, diverting an estimated 600 L/week.",
    next: "Test a recycled PETG variant and publish open print files.",
    journey: [
      { step: "Idea", date: "Feb 2026", text: "Noticed water waste in residence kitchens; framed the problem with two classmates." },
      { step: "Initial Work", date: "Mar 2026", text: "First sketches and v1 housing model.", material: "Sketchbook scans" },
      { step: "Evidence Added", date: "Apr 2026", text: "Uploaded v2 files, renders and contribution statement.", material: "4 files" },
      { step: "Feedback", date: "Jul 2026", text: "Lecturer review flagged UV exposure on outdoor units.", material: "Review notes" },
      { step: "Revision", date: "Jul 2026", text: "Redesigned walls and reduced material use in v3.", material: "v3 model" },
      { step: "Demonstration", date: "Aug 2026", text: "Live assembly demonstration with facilities team.", material: "Video" },
      { step: "Outcome", date: "Sep 2026", text: "Pilot installation running; results logged weekly." },
    ],
  },
  {
    id: "fieldnote-app",
    title: "FieldNote",
    description: "An offline-first app that helps agricultural extension officers log farm visits and share insights.",
    discipline: "Software",
    stage: "In Progress",
    team: { type: "Individual", size: 1, myRole: "Sole designer and developer — research, interface design and React build." },
    capabilities: ["react-development", "visual-design", "user-research"],
    evidenceCount: 6,
    problem: "Extension officers record visits on paper, losing data and delaying follow-up advice.",
    solution: "A lightweight progressive web app that works without signal and syncs when back online.",
    samples: [
      { title: "Source repository", kind: "Code" },
      { title: "Design system", kind: "Figma" },
      { title: "Walkthrough recording", kind: "Video" },
    ],
    feedback: [{ from: "Grace Njeri", role: "Extension officer (tester)", text: "Visit form is fast. Photo capture needs a compression option.", date: "11 Sep 2026" }],
    iterations: [
      { version: "Alpha", change: "Paper-form replica; too many fields." },
      { version: "Beta", change: "Reduced to 7 core fields with smart defaults." },
    ],
    outcome: "Beta used by 4 officers over 3 weeks; 120 visits logged.",
    next: "Add image compression and a weekly summary export.",
    journey: [
      { step: "Idea", date: "May 2026", text: "Shadowed two officers on field visits." },
      { step: "Initial Work", date: "Jun 2026", text: "Wireframes and alpha build." },
      { step: "Feedback", date: "Sep 2026", text: "Tester feedback on photos and sync." },
    ],
  },
  {
    id: "market-ledger",
    title: "Market Ledger Pilot",
    description: "A simple record-keeping service for market vendors exploring access to micro-credit.",
    discipline: "Business Innovation",
    stage: "Completed",
    team: { type: "Team", size: 5, myRole: "Led user research — planned and ran 12 vendor interviews and wrote the synthesis.", collective: "Team designed the service model, ran the pilot and produced the financial model." },
    capabilities: ["user-research", "team-facilitation"],
    evidenceCount: 5,
    problem: "Vendors lack transaction records, making it hard to demonstrate creditworthiness.",
    solution: "A weekly ledger card system with an SMS summary, piloted with a local co-op.",
    samples: [{ title: "Interview synthesis", kind: "Report" }, { title: "Board presentation", kind: "Slides" }],
    feedback: [{ from: "Samuel Otieno", role: "Programme Lead, Ukulima Co-op", text: "Insights reshaped the pilot priorities.", date: "22 Mar 2026" }],
    iterations: [{ version: "Pilot 1", change: "Paper only." }, { version: "Pilot 2", change: "Added SMS weekly summaries." }],
    outcome: "18 vendors kept records for 8 weeks; co-op continuing the programme.",
    next: "Handover document completed.",
    journey: [{ step: "Outcome", date: "Apr 2026", text: "Pilot concluded and handed to the co-op." }],
  },
  {
    id: "campus-wayfinding",
    title: "Campus Wayfinding System",
    description: "Signage concepts and a 3D site model to make a busy campus easier to navigate.",
    discipline: "Creative Problem-Solving",
    stage: "Completed",
    team: { type: "Individual", size: 1, myRole: "Individual project — research, signage design and 3D site model." },
    capabilities: ["visual-design", "3d-modelling"],
    evidenceCount: 4,
    problem: "First-week visitors report getting lost between the library and lecture halls.",
    solution: "A colour-zoned signage family tested for legibility at distance.",
    samples: [{ title: "Signage layouts", kind: "Images" }, { title: "Site model", kind: "3D model" }],
    feedback: [{ from: "Peer critique group", role: "Design students", text: "Zone colours are clear; arrows could be larger.", date: "10 Nov 2025" }],
    iterations: [{ version: "v1", change: "Text-heavy signs." }, { version: "v2", change: "Icon-led with colour zones." }],
    outcome: "Concept presented to estates office.",
    next: "Awaiting estates decision.",
    journey: [{ step: "Demonstration", date: "Dec 2025", text: "Presented to estates office." }],
  },
  {
    id: "solar-dryer",
    title: "Solar Crop Dryer Rig",
    description: "A low-cost dryer that reduces post-harvest losses for smallholder mango farmers.",
    discipline: "Engineering",
    stage: "Idea",
    team: { type: "Team", size: 4, myRole: "Planned role: enclosure CAD and airflow documentation.", collective: "Team will build and field-test the rig." },
    capabilities: ["3d-modelling", "systems-thinking"],
    evidenceCount: 1,
    problem: "Up to 40% of mangoes spoil before reaching market in peak season.",
    solution: "Passive solar dryer using locally available materials.",
    samples: [{ title: "Concept brief", kind: "Document" }],
    feedback: [],
    iterations: [],
    outcome: "Concept stage.",
    next: "Build a 1:4 scale model.",
    journey: [{ step: "Idea", date: "Sep 2026", text: "Concept brief drafted with team." }],
  },
  {
    id: "repair-cafe",
    title: "Repair Café Toolkit",
    description: "A guide and booking system for monthly community repair events.",
    discipline: "Sustainability",
    stage: "In Progress",
    team: { type: "Team", size: 2, myRole: "Wrote the volunteer guide and designed event materials.", collective: "Partner built the booking spreadsheet and ran logistics." },
    capabilities: ["technical-writing", "visual-design"],
    evidenceCount: 3,
    problem: "Repairable items are discarded because people lack tools and know-how.",
    solution: "A repeatable event format with a volunteer toolkit.",
    samples: [{ title: "Volunteer guide", kind: "PDF" }, { title: "Event poster set", kind: "Images" }],
    feedback: [{ from: "Event attendees", role: "Survey (n=34)", text: "91% would attend again.", date: "05 Sep 2026" }],
    iterations: [{ version: "Event 1", change: "No booking; long queues." }, { version: "Event 2", change: "Added time-slot booking." }],
    outcome: "3 events held; 87 items repaired.",
    next: "Publish toolkit for other neighbourhoods.",
    journey: [{ step: "Demonstration", date: "Sep 2026", text: "Third event held." }],
  },
];

export const person = {
  name: "Victorious Kibaki",
  initials: "VK",
  headline: "Product designer & maker · sustainable hardware and civic tech",
  location: "Nairobi, Kenya",
  intro:
    "I'm a Nairobi-based maker. I design physical and digital products that solve everyday problems in resource-constrained settings. I learn best by building — most of what I know started as a prototype that didn't quite work.",
  focus: ["Product design", "Sustainable hardware", "Civic technology", "Human-centred research"],
  goals: [
    "Get a second capability reviewed by an industry practitioner",
    "Complete the FieldNote beta with 10 active users",
    "Find a mentor in circular-economy product design",
  ],
  interests: {
    fields: ["Circular economy", "AgriTech", "Design for repair"],
    experience: ["Product design internship", "Hardware startup collaboration", "Mentorship"],
  },
};

export const growth = [
  { date: "Sep 2026", kind: "Evidence", text: "Added pilot results to AquaLoop Greywater Filter" },
  { date: "Sep 2026", kind: "Feedback", text: "Received tester feedback on FieldNote photo capture" },
  { date: "Aug 2026", kind: "Review", text: "3D Modelling reviewed by Dr. Imani Wekesa" },
  { date: "Jul 2026", kind: "Improvement", text: "AquaLoop v3: UV-resistant walls, 18% less material" },
  { date: "Jun 2026", kind: "Project", text: "Started FieldNote" },
  { date: "Apr 2026", kind: "Project", text: "Completed Market Ledger Pilot" },
  { date: "Mar 2026", kind: "Skill", text: "Added User Research capability" },
];

export const capBySlug = (s: string) => capabilities.find((c) => c.slug === s);
export const projectById = (id: string) => projects.find((p) => p.id === id);

export type AIEmployee = {
  name: string;
  role: string;
  focus: string;
  tools: string[];
  status: "Active" | "On a task" | "Idle";
  stats: { label: string; value: string }[];
  recent: string;
  supervisedBy: string;
};

// AI employees work for the individual; their output is supervised and
// signed off by the human, and is never counted as the human's own evidence.
export const aiEmployees: AIEmployee[] = [
  {
    name: "Nia",
    role: "Research Analyst",
    focus: "Market scans, literature reviews and user-interview synthesis.",
    tools: ["Web research", "Docs", "Sheets"],
    status: "On a task",
    stats: [{ label: "Briefs delivered", value: "42" }, { label: "Avg. turnaround", value: "3h" }],
    recent: "Compiled a 30-source review on recycled PETG for AquaLoop v4.",
    supervisedBy: "Victorious reviews every brief before use.",
  },
  {
    name: "Kito",
    role: "CAD & Render Assistant",
    focus: "Generates render variations, exploded views and print-prep checks.",
    tools: ["Fusion 360", "KeyShot", "Slicer"],
    status: "Active",
    stats: [{ label: "Renders produced", value: "310" }, { label: "Print checks", value: "58" }],
    recent: "Produced 12 colourway renders for the wayfinding signage set.",
    supervisedBy: "Design decisions stay with Victorious.",
  },
  {
    name: "Zuri",
    role: "Full-stack Dev Agent",
    focus: "Writes tests, fixes bugs and ships small features on FieldNote.",
    tools: ["GitHub", "React", "CI"],
    status: "Active",
    stats: [{ label: "PRs merged", value: "87" }, { label: "Test coverage", value: "+31%" }],
    recent: "Added offline image compression — pending Victorious's code review.",
    supervisedBy: "All PRs require Victorious's approval.",
  },
  {
    name: "Baraka",
    role: "Client & Ops Coordinator",
    focus: "Scheduling, proposals, invoices and follow-ups with clients.",
    tools: ["Email", "Calendar", "Invoicing"],
    status: "Idle",
    stats: [{ label: "Proposals drafted", value: "19" }, { label: "Response time", value: "<1h" }],
    recent: "Drafted a proposal for a 3-week agri-startup prototype gig.",
    supervisedBy: "Sends only after Victorious approves.",
  },
];
