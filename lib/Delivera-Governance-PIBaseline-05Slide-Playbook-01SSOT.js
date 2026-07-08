/**
 * SSOT: PI slide epic playbooks, canonical titles, target dates.
 */
export const EPIC_DELIM = ' – ';

const MONTH_INDEX = Object.freeze({
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
});

export function buildCanonicalEpicTitle({
  quarter = 'FY27 Q2',
  program = 'DMS',
  system = 'NBA',
  capability = 'Product Goal',
} = {}) {
  const q = String(quarter || '').replace(/\s+/g, ' ').trim();
  const parts = [program, system, capability].map((p) => String(p || '').trim()).filter(Boolean);
  return `${q}${EPIC_DELIM}${parts.join(EPIC_DELIM)}`;
}

export function normalizeEpicTitle(title = '') {
  return String(title || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function quarterKey(quarter = '') {
  const m = String(quarter || '').match(/fy\s*(\d{2})\s*q\s*([1-4])/i);
  if (!m) return '';
  return `FY${m[1]} Q${m[2]}`.toUpperCase();
}

export function squadKey(projects = []) {
  const pk = String(projects[0] || '').toUpperCase();
  if (pk === 'SD' || /dms/i.test(pk)) return 'DMS';
  return pk || 'DMS';
}

export function deriveTargetDate(month = '', quarter = '') {
  const q = quarterKey(quarter);
  const qm = q.match(/FY(\d{2})\s+Q([1-4])/i);
  if (!qm) return '';
  const fy = Number(qm[1]);
  const qn = Number(qm[2]);
  const yearBase = 2000 + fy - 1;
  const year = qn === 4 ? yearBase + 1 : yearBase;
  const monthName = String(month || '').trim().toLowerCase();
  let monthNum = MONTH_INDEX[monthName] || 0;
  if (!monthNum) {
    const qDefault = { 1: 6, 2: 9, 3: 12, 4: 3 };
    monthNum = qDefault[qn] || 0;
  }
  if (!monthNum) return '';
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  return `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export const EPIC_PLAYBOOKS = Object.freeze({
  'DMS:FY27 Q2': [
    {
      matchTerms: ['cvm', 'channel', 'productivity', 'soga', 'focus cluster', 'acquisition'],
      epicTitle: 'FY27 Q2 – DMS – NBA – Integration of CVM for Channel Productivity Campaigns',
      month: 'July',
      theme: 'Growth',
      duplicateSearchTerms: ['cvm', 'channel productivity', 'soga'],
      childStories: [
        {
          title: 'NBA should display CVM-managed Pilot Soga Focus Cluster campaign',
          description: 'CVM and Acquisition define the campaign, target base, control group, campaign period and message. NBA displays the campaign action to the correct sales leader.',
        },
        {
          title: 'NBA should display all CVM-managed productivity and channel campaigns',
          description: 'NBA consumes approved CVM campaign data and displays prioritized campaign actions without NBA owning campaign definition or base refresh logic.',
        },
        {
          title: 'NBA should display Inactive Freelancers campaign',
          description: 'NBA surfaces the Inactive Freelancers campaign action to the relevant sales leader when CVM publishes the campaign.',
        },
      ],
    },
    {
      matchTerms: ['evod', 'ev od'],
      epicTitle: 'FY27 Q2 – DMS – NBA – EVOD Upgrade',
      month: 'July',
      theme: 'Growth',
      duplicateSearchTerms: ['evod'],
      duplicatePrograms: ['devsecops', 'devops'],
      notes: 'Check DevSecOps or DMS before creating — avoid duplicate technical epic.',
    },
    {
      matchTerms: ['nba enhancement', 'enhancement', 'link to site', 'cluster profile', 'user feedback'],
      epicTitle: 'FY27 Q2 – DMS – NBA – Enhancements',
      month: 'July',
      theme: 'Simplicity',
      duplicateSearchTerms: ['nba enhancement', 'enhancements'],
      notes: 'Create only if enhancements are tracked as a delivery bucket; prefer stories under relevant epic where possible.',
    },
    {
      matchTerms: ['ehod', 'e-hod', 'regional profile', 'regional level', 'realtime performance'],
      epicTitle: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
      month: 'August',
      theme: 'Growth',
      duplicateSearchTerms: ['ehod', 'e-hod', 'regional profile', 'leaders version', 'sd-4671'],
      notes: 'May reuse Leaders Version (SD-4671) or regional leader stories.',
    },
    {
      matchTerms: ['drill down', 'territory', 'cluster', 'site profile'],
      epicTitle: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
      month: 'August',
      theme: 'Growth',
      duplicateSearchTerms: ['ehod drill', 'territory profile', 'cluster profile', 'site profile'],
      notes: 'Drill-down scope — prefer child stories under E-HOD Regional Profile epic.',
      childStories: [
        { title: 'E-HOD should drill down to territory profile', description: 'Realtime performance report at territory level with benchmarking vs targets and past.' },
        { title: 'E-HOD should drill down to cluster profile', description: 'Cluster-level performance view with gross add, active FL, OG revenue and channel recharge.' },
        { title: 'E-HOD should drill down to site profile', description: 'Site-level profile with acquisition share, customer market share and SP penetration.' },
      ],
    },
    {
      matchTerms: ['merge dms', 'capability merging', 'cbu', 'mpesa', 'duplication'],
      epicTitle: 'FY27 Q2 – DMS – DMS Capability Merging',
      month: 'September',
      theme: 'Simplicity',
      duplicateSearchTerms: ['capability merging', 'merge dms', 'cbu', 'mpesa'],
    },
    {
      matchTerms: ['vop upgrade', 'vop'],
      epicTitle: 'FY27 Q2 – DMS – VOP Upgrade',
      month: 'September',
      theme: 'Simplicity',
      duplicateSearchTerms: ['vop'],
      duplicatePrograms: ['devsecops', 'devops'],
      notes: 'Check DevSecOps before creating — avoid duplicate technical epic.',
    },
  ],
});

export function commitmentLabel(row = {}) {
  return [row.theme, row.bullet, row.title].filter(Boolean).join(' ');
}

export function findPlaybookEntry(row, playbook = []) {
  const label = commitmentLabel(row).toLowerCase();
  if (!label) return null;
  let best = null;
  let bestScore = 0;
  for (const entry of playbook) {
    const terms = entry.matchTerms || [];
    let hits = 0;
    for (const term of terms) {
      if (label.includes(String(term).toLowerCase())) hits += 1;
    }
    const score = hits / Math.max(terms.length, 1);
    if (hits > 0 && (score >= 0.34 || hits >= 2) && score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}

export function mergeChildStories(a = [], b = []) {
  const out = [];
  const seen = new Set();
  for (const story of [...(a || []), ...(b || [])]) {
    const key = String(story?.title || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(story);
  }
  return out;
}

export function playbookForProjects(projects = [], quarter = '') {
  const qKey = quarterKey(quarter) || 'FY27 Q2';
  const squad = squadKey(projects);
  return EPIC_PLAYBOOKS[`${squad}:${qKey}`] || [];
}
