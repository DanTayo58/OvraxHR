import { Applicant } from '../types';

export const INITIAL_APPLICANTS: Applicant[] = [
  {
    id: 'app-101',
    name: 'Alexander Wright',
    email: 'alex.wright@example.com',
    phone: '+1 (555) 234-8910',
    appliedDepartment: 'Engineering',
    appliedRole: 'Senior Full Stack Engineer',
    experienceYears: 6,
    expectedSalary: 5500,
    education: 'B.Sc. Computer Science, Stanford University',
    skills: ['TypeScript', 'React', 'Node.js', 'SQL', 'Docker', 'API Architecture', 'CI/CD', 'Git'],
    resumeText: `Alexander Wright
Senior Full Stack Software Engineer | 6 Years Experience

PROFESSIONAL SUMMARY
Highly experienced engineer specializing in modern web architecture, React, Node.js, and distributed microservices. Proven track record of scaling enterprise web applications, optimizing SQL queries, and leading agile engineering teams.

EXPERIENCE
• Lead Frontend Engineer, CloudScale Systems (2022 - Present)
  - Built responsive enterprise analytics portals using TypeScript and React.
  - Implemented CI/CD automated deployment pipelines with Docker and GitHub Actions.
  - Reduced load times by 42% through performance optimization and code splitting.
• Software Engineer, Apex Digital (2020 - 2022)
  - Developed REST and GraphQL APIs using Node.js and PostgreSQL.
  - Collaborated across product, design, and operations teams to ship core billing modules.

EDUCATION
• B.Sc. in Computer Science - Stanford University (2016 - 2020)

CORE COMPETENCIES
TypeScript, React, Node.js, REST APIs, SQL, Docker, Unit Testing, Agile Leadership.`,
    appliedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Pending',
    notes: 'Exceptional portfolio and strong GitHub code samples. Passed technical phone screen.',
    rating: 5,
  },
  {
    id: 'app-102',
    name: 'Clara Nnamdi',
    email: 'clara.nnamdi@example.com',
    phone: '+1 (555) 492-1130',
    appliedDepartment: 'Operations',
    appliedRole: 'Operations & Logistics Manager',
    experienceYears: 4,
    expectedSalary: 4200,
    education: 'B.A. Business Administration, University of Lagos',
    skills: ['Process Optimization', 'Logistics', 'Supply Chain', 'KPI Reporting', 'Vendor Management', 'Cross-Functional', 'Project Management'],
    resumeText: `Clara Nnamdi
Operations & Logistics Specialist | 4 Years Experience

PROFESSIONAL SUMMARY
Operations specialist adept in supply chain logistics, cross-functional coordination, and workflow process optimization. Experienced in managing vendor relationships, SOP documentation, and department KPI reporting.

EXPERIENCE
• Operations Coordinator, SwiftRoute Global (2022 - Present)
  - Supervised 15+ warehouse fulfillment routes, increasing on-time deliveries by 28%.
  - Designed standard operating procedures (SOPs) reducing logistics bottlenecks.
  - Monitored daily operational KPIs and reconciled department budgets.
• Logistics Associate, Metro Express (2020 - 2022)
  - Managed inventory audits and vendor contracts for corporate accounts.

EDUCATION
• B.A. in Business Administration - University of Lagos

CORE COMPETENCIES
Logistics management, Process optimization, ERP systems, Vendor relations, KPI reporting.`,
    appliedDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Interviewing',
    notes: 'Great cultural fit and solid operational background. Recommended for final executive interview.',
    rating: 4,
  },
  {
    id: 'app-103',
    name: 'Sophia Patel',
    email: 'sophia.patel@example.com',
    phone: '+1 (555) 781-9922',
    appliedDepartment: 'Finance',
    appliedRole: 'Senior Financial Analyst',
    experienceYears: 5,
    expectedSalary: 4800,
    education: 'M.Sc. Finance & Accounting, London School of Economics',
    skills: ['Budgeting', 'Financial Analysis', 'Auditing', 'Excel', 'Cash Flow', 'Forecasting', 'Compliance', 'Taxation'],
    resumeText: `Sophia Patel, CFA Level II
Financial Analyst & Corporate Auditor | 5 Years Experience

PROFESSIONAL SUMMARY
Analytical finance professional with deep experience in corporate financial modeling, budget forecasting, internal audits, and regulatory compliance.

EXPERIENCE
• Financial Analyst, Horizon Capital Group (2021 - Present)
  - Prepared annual financial forecasts, variance reports, and quarterly board presentations.
  - Monitored company cash flows, OPEX, and CAPEX across 4 global subsidiaries.
  - Partnered with HR and operations on payroll auditing and budget governance.
• Junior Accountant, KPMG (2019 - 2021)
  - Conducted internal audits and bank reconciliations for enterprise clients.

EDUCATION
• M.Sc. in Finance & Accounting - London School of Economics (2019)
• B.Sc. in Economics - Manchester University (2017)

CORE COMPETENCIES
Financial modeling, Budgeting, GAAP, Taxation, Cash flow forecasting, Excel modeling.`,
    appliedDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Pending',
    notes: 'Outstanding financial modeling test score (96%). Ready for hiring manager review.',
    rating: 5,
  },
  {
    id: 'app-104',
    name: 'Marcus Sterling',
    email: 'marcus.sterling@example.com',
    phone: '+1 (555) 890-4411',
    appliedDepartment: 'Human Resources',
    appliedRole: 'HR Generalist & Talent Specialist',
    experienceYears: 3,
    expectedSalary: 3800,
    education: 'B.Sc. Human Resource Management, Ohio State University',
    skills: ['Recruitment', 'Onboarding', 'Talent Acquisition', 'Employee Relations', 'HRIS', 'Labor Compliance', 'Payroll'],
    resumeText: `Marcus Sterling
Human Resources Specialist | 3 Years Experience

PROFESSIONAL SUMMARY
Dedicated HR professional experienced in full-lifecycle recruitment, onboarding workflows, talent acquisition, and employee performance tracking.

EXPERIENCE
• Talent Acquisition Associate, BrightPath Tech (2023 - Present)
  - Managed applicant tracking systems (ATS) and sourced 40+ engineering candidates.
  - Facilitated new-hire orientation, documentation, and compliance verification.
• HR Assistant, Vanguard Media (2021 - 2023)
  - Maintained employee personnel files, shift rosters, and benefit enrollments.

EDUCATION
• B.Sc. in Human Resource Management - Ohio State University

CORE COMPETENCIES
Recruitment, Candidate screening, Onboarding, HRIS systems, Employment documentation.`,
    appliedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Screened',
    notes: 'Strong understanding of HR compliance and onboarding pipelines.',
    rating: 4,
  },
];
