import { Applicant, ATSScoreResult, DepartmentInfo, JobVacancy } from '../types';
import { getStaffRoleDutiesInfo } from './documentTemplates';

// Common technical and functional domain keywords by department
const DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  engineering: [
    'typescript', 'javascript', 'react', 'node.js', 'python', 'api', 'architecture',
    'git', 'ci/cd', 'docker', 'sql', 'testing', 'debugging', 'cloud', 'agile', 'database', 'frontend', 'backend'
  ],
  development: [
    'typescript', 'javascript', 'react', 'node.js', 'python', 'api', 'git', 'fullstack', 'css', 'html', 'rest'
  ],
  marketing: [
    'seo', 'sem', 'copywriting', 'analytics', 'content strategy', 'social media', 'campaigns',
    'roi', 'branding', 'email marketing', 'market research', 'conversions', 'lead generation'
  ],
  sales: [
    'pipeline', 'crm', 'negotiation', 'lead generation', 'cold calling', 'b2b', 'revenue',
    'quota', 'closing', 'account management', 'presentations', 'prospecting'
  ],
  finance: [
    'budgeting', 'accounting', 'auditing', 'financial analysis', 'forecasting', 'excel',
    'reconciliation', 'gaap', 'taxation', 'cash flow', 'reporting', 'compliance'
  ],
  accounting: [
    'bookkeeping', 'invoicing', 'ledger', 'payroll', 'reconciliation', 'financial statements', 'tax'
  ],
  operations: [
    'process optimization', 'workflow', 'logistics', 'supply chain', 'kpi', 'vendor management',
    'cross-functional', 'project management', 'sop', 'operational efficiency', 'quality assurance'
  ],
  human_resources: [
    'recruitment', 'onboarding', 'talent acquisition', 'employee relations', 'ats',
    'payroll', 'labor compliance', 'training', 'performance management', 'hris', 'benefits'
  ],
  hr: [
    'recruitment', 'onboarding', 'talent acquisition', 'employee relations', 'ats',
    'payroll', 'labor compliance', 'training', 'performance management', 'hris'
  ],
  design: [
    'ui/ux', 'figma', 'wireframing', 'user research', 'prototyping', 'design systems',
    'typography', 'adobe creative suite', 'visual design', 'interaction design'
  ],
  support: [
    'customer service', 'troubleshooting', 'ticket resolution', 'communication', 'zendesk',
    'escalation', 'client satisfaction', 'empathy', 'slas', 'knowledge base'
  ],
};

function normalizeText(text: string): string {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

/**
 * Calculates ATS Percentage Match and deep role correlation
 * for an applicant applying to a specific role in a department.
 */
export function calculateATSScore(
  applicant: Applicant,
  departments: DepartmentInfo[] = [],
  vacancy?: JobVacancy
): ATSScoreResult {
  // Only evaluate actual candidate skills, resume text, notes, and educational background
  // (Do NOT include applicant.appliedRole or applicant.name to prevent false-positive self-matching)
  const candidateSkillsText = (applicant.skills || []).join(' ');
  const candidateQualificationsText = `${candidateSkillsText} ${applicant.resumeText || ''} ${applicant.notes || ''} ${applicant.courseOfStudy || ''} ${applicant.education || ''} ${applicant.educationalLevel || ''}`;
  const candidateNormText = normalizeText(candidateQualificationsText);

  const deptKey = (applicant.appliedDepartment || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const deptKeywords = DEPARTMENT_KEYWORDS[deptKey] || DEPARTMENT_KEYWORDS[applicant.appliedDepartment.toLowerCase()] || [
    'communication', 'teamwork', 'problem solving', 'organization', 'deliverables', 'leadership', 'efficiency'
  ];

  // Retrieve official duties & role info from document templates & department settings
  const roleDutiesInfo = getStaffRoleDutiesInfo({
    department: applicant.appliedDepartment,
    role: applicant.appliedRole,
  });

  const dutyItems = roleDutiesInfo.items || [];
  const duties = dutyItems.map((i) => i.text).filter(Boolean);
  
  // Extract explicit keywords from role description items (ATS compliance detection keywords)
  const explicitRoleKeywords: string[] = [];
  dutyItems.forEach((item) => {
    if (item.keyword && item.keyword.trim()) {
      const splitKws = item.keyword.split(/[,;/|]+/).map((k) => k.trim()).filter(Boolean);
      explicitRoleKeywords.push(...splitKws);
    }
  });

  // Extract core domain keywords from official duties text
  const dutyKeywords: string[] = [];
  duties.forEach((duty) => {
    const words = normalizeText(duty)
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['with', 'from', 'this', 'that', 'have', 'been', 'their', 'must', 'will', 'role', 'team', 'work', 'about', 'other', 'each'].includes(w));
    dutyKeywords.push(...words);
  });

  // Include vacancy-specific keywords if vacancy is configured
  const vacancyKeywords: string[] = [];
  if (vacancy) {
    if (Array.isArray(vacancy.requiredSkills)) {
      vacancy.requiredSkills.forEach((s) => {
        if (s && s.trim()) vacancyKeywords.push(s.trim().toLowerCase());
      });
    }
    if (Array.isArray(vacancy.titleKeywords)) {
      vacancy.titleKeywords.forEach((tk) => {
        if (tk && tk.trim()) vacancyKeywords.push(tk.trim().toLowerCase());
      });
    }
    if (vacancy.description) {
      const vWords = normalizeText(vacancy.description)
        .split(/\s+/)
        .filter((w) => w.length > 3 && !['with', 'from', 'this', 'that', 'have', 'been', 'their', 'must', 'will', 'role', 'team', 'work', 'about', 'other', 'each'].includes(w));
      vacancyKeywords.push(...vWords.slice(0, 8));
    }
  }

  // Build target keywords pool specifically weighted for this role & vacancy
  const targetRoleKeywords = explicitRoleKeywords.length > 0
    ? Array.from(new Set([...vacancyKeywords, ...explicitRoleKeywords.map((k) => k.toLowerCase()), ...dutyKeywords.slice(0, 10)]))
    : Array.from(new Set([...vacancyKeywords, ...dutyKeywords, ...deptKeywords.slice(0, 8)]));

  const allTargetKeywords = targetRoleKeywords.length > 0 ? targetRoleKeywords : deptKeywords;

  // 1. Keyword & Skills Match Scoring (/100 expectancy)
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  allTargetKeywords.forEach((kw) => {
    const kwNorm = kw.toLowerCase().trim();
    if (!kwNorm) return;
    // Check if the candidate's skills or resume contains this keyword or phrase
    if (candidateNormText.includes(kwNorm)) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  });

  const keywordCoverageRatio = allTargetKeywords.length > 0
    ? matchedKeywords.length / allTargetKeywords.length
    : 0.5;

  const keywordScore = Math.min(100, Math.round(keywordCoverageRatio * 100));

  // 2. Experience Level Scoring
  const exp = Number(applicant.experienceYears) || 0;
  let experienceScore = 70;
  if (vacancy && typeof vacancy.experienceRequired === 'number' && vacancy.experienceRequired > 0) {
    if (exp >= vacancy.experienceRequired) {
      experienceScore = 98;
    } else if (exp >= vacancy.experienceRequired - 1) {
      experienceScore = 85;
    } else if (exp >= Math.max(1, vacancy.experienceRequired - 2)) {
      experienceScore = 72;
    } else {
      experienceScore = 55;
    }
  } else {
    if (exp >= 5) experienceScore = 98;
    else if (exp >= 3) experienceScore = 88;
    else if (exp >= 1) experienceScore = 78;
    else if (exp > 0) experienceScore = 65;
  }

  // 3. Education & Qualification Alignment (incorporating level, course of study & grade)
  let educationScore = 75;
  const eduLower = `${applicant.education || ''} ${applicant.educationalLevel || ''} ${applicant.courseOfStudy || ''} ${applicant.schoolGrade || ''}`.toLowerCase();
  
  if (eduLower.includes('doctorate') || eduLower.includes('ph.d') || eduLower.includes('phd')) {
    educationScore = 98;
  } else if (eduLower.includes('master') || eduLower.includes('mba') || eduLower.includes('m.sc') || eduLower.includes('msc')) {
    educationScore = 94;
  } else if (eduLower.includes('bachelor') || eduLower.includes('degree') || eduLower.includes('bsc') || eduLower.includes('ba') || eduLower.includes('b.eng')) {
    educationScore = 88;
  } else if (eduLower.includes('postgraduate') || eduLower.includes('pgd')) {
    educationScore = 85;
  } else if (eduLower.includes('diploma') || eduLower.includes('associate') || eduLower.includes('certified') || eduLower.includes('hnd')) {
    educationScore = 80;
  } else if (eduLower.includes('none')) {
    educationScore = 60;
  }

  // Bonus for outstanding school grade
  if (eduLower.includes('first class') || eduLower.includes('distinction') || eduLower.includes('4.0') || eduLower.includes('summa cum laude')) {
    educationScore = Math.min(100, educationScore + 8);
  } else if (eduLower.includes('second class upper') || eduLower.includes('2:1') || eduLower.includes('merit') || eduLower.includes('3.5')) {
    educationScore = Math.min(100, educationScore + 4);
  }

  // 4. Duty-by-duty Breakdown analysis (with weighted Key KPI multipliers)
  let weightedDutyScoreSum = 0;
  let totalDutyWeight = 0;
  let matchedKeyKPIsCount = 0;
  let totalKeyKPIsCount = 0;

  const dutyBreakdown = dutyItems.map((item, idx) => {
    const duty = item.text || duties[idx] || '';
    const isKey = !!item.isKey;
    const itemKeyword = item.keyword || '';
    
    if (isKey) totalKeyKPIsCount++;

    const dWords = normalizeText(`${duty} ${itemKeyword}`).split(/\s+/).filter((w) => w.length > 3);
    let score = 50;
    let matched = false;

    if (dWords.length === 0) {
      score = 75;
      matched = true;
    } else {
      const hits = dWords.filter((w) => candidateNormText.includes(w)).length;
      const ratio = hits / dWords.length;
      score = Math.min(100, Math.round(ratio * 130));
      matched = ratio >= 0.20 || (itemKeyword && candidateNormText.includes(itemKeyword.toLowerCase().trim()));
    }

    if (isKey && matched) {
      matchedKeyKPIsCount++;
    }

    // Weight: Key KPI descriptions carry 2.5x higher weight
    const weight = isKey ? 2.5 : 1.0;
    weightedDutyScoreSum += Math.max(35, score) * weight;
    totalDutyWeight += weight;

    return {
      duty: itemKeyword ? `[ATS: ${itemKeyword}] ${duty}` : duty,
      matched,
      score: Math.max(35, score),
      isKey,
    };
  });

  // Calculate Weighted Overall Match Percentage
  const avgDutyScore = totalDutyWeight > 0
    ? weightedDutyScoreSum / totalDutyWeight
    : 70;

  const rawOverall = Math.round(
    keywordScore * 0.40 +
    avgDutyScore * 0.30 +
    experienceScore * 0.18 +
    educationScore * 0.12
  );

  // Bound to sensible 35% - 99%
  const overallPercentage = Math.min(99, Math.max(35, rawOverall));

  // Determine Grade & Color
  let grade: ATSScoreResult['grade'] = 'Moderate Match';
  let color = 'text-amber-500 bg-amber-500/10 border-amber-500/30';

  if (overallPercentage >= 85) {
    grade = 'Exceptional Match';
    color = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  } else if (overallPercentage >= 70) {
    grade = 'Strong Correlation';
    color = 'text-blue-500 bg-blue-500/10 border-blue-500/30';
  } else if (overallPercentage >= 50) {
    grade = 'Moderate Match';
    color = 'text-amber-500 bg-amber-500/10 border-amber-500/30';
  } else {
    grade = 'Low Correlation';
    color = 'text-rose-500 bg-rose-500/10 border-rose-500/30';
  }

  // Strengths & Growth Areas
  const strengths: string[] = [];
  if (keywordScore >= 70) strengths.push(`Strong keyword correlation in ${applicant.appliedDepartment} competencies.`);
  if (totalKeyKPIsCount > 0 && matchedKeyKPIsCount >= totalKeyKPIsCount) {
    strengths.push(`High compatibility in ${matchedKeyKPIsCount}/${totalKeyKPIsCount} critical Key KPI deliverables.`);
  }
  if (exp >= 3) strengths.push(`${exp}+ years of practical domain background.`);
  if (applicant.courseOfStudy) {
    strengths.push(`Academic specialization in ${applicant.courseOfStudy}${applicant.schoolGrade ? ` (${applicant.schoolGrade})` : ''}.`);
  } else if (educationScore >= 85) {
    strengths.push(`Strong academic credentials (${applicant.education || applicant.educationalLevel || 'Degree'}).`);
  }
  if (matchedKeywords.length > 0) {
    strengths.push(`Identified core capabilities: ${matchedKeywords.slice(0, 4).join(', ')}.`);
  }

  const growthAreas: string[] = [];
  if (totalKeyKPIsCount > 0 && matchedKeyKPIsCount < totalKeyKPIsCount) {
    growthAreas.push(`Candidate resume needs closer alignment with primary Key KPI deliverables (${matchedKeyKPIsCount}/${totalKeyKPIsCount} matched).`);
  }
  if (missingKeywords.length > 0) {
    growthAreas.push(`Candidate profile could expand on: ${missingKeywords.slice(0, 3).join(', ')}.`);
  }
  if (exp < 2) {
    growthAreas.push('Junior tenure: may require introductory departmental onboarding & mentoring.');
  }

  const summary = `${applicant.name} achieves a ${overallPercentage}% ${grade} for the ${applicant.appliedRole} position in the ${applicant.appliedDepartment} Department, matching ${matchedKeywords.length} key domain keywords.`;

  return {
    overallPercentage,
    grade,
    color,
    keywordScore,
    experienceScore,
    educationScore,
    matchedKeywords: matchedKeywords.slice(0, 10),
    missingKeywords: missingKeywords.slice(0, 8),
    dutyBreakdown: dutyBreakdown.slice(0, 8),
    summary,
    strengths: strengths.length > 0 ? strengths : ['Candidate meets preliminary baseline qualifications.'],
    growthAreas: growthAreas.length > 0 ? growthAreas : ['No immediate critical competency gaps identified.'],
  };
}
