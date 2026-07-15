/**
 * SSOT: PI slide epic playbooks, canonical titles, target dates.
 */
import {
  buildEpicTitleFromFormat,
  DEFAULT_EPIC_FORMAT,
  EPIC_DELIM,
} from './Delivera-Governance-Epic-Format-01SSOT.js';

export { EPIC_DELIM };

const MONTH_INDEX = Object.freeze({
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
});

export function buildCanonicalEpicTitle({
  quarter = 'FY27 Q2',
  program = 'DMS',
  system = 'NBA',
  module = '',
  capability = 'Product Goal',
} = {}, format = DEFAULT_EPIC_FORMAT) {
  return buildEpicTitleFromFormat({
    quarter,
    squad: program,
    subsystem: system,
    module,
    capability,
  }, format);
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
  const pk = String(projects[0] || '').toUpperCase().trim();
  if (pk === 'SD' || /dms/i.test(pk)) return 'DMS';
  if (pk === 'FIN' || /tycoon|finance/i.test(pk)) return 'FIN';
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
  'DMS:FY27 Q1': [
    {
      matchTerms: ['territory', 'daily report', 'performance', 'benchmark'],
      epicTitle: 'FY27 Q1 – DMS – NBA – Territory Daily Report and Performance',
      month: 'April',
      theme: 'Growth',
      duplicateSearchTerms: ['territory', 'daily report', 'regional profile'],
    },
    {
      matchTerms: ['smartphone', 'penetration', 'sp users'],
      epicTitle: 'FY27 Q1 – DMS – NBA – Smartphone Penetration',
      month: 'April',
      theme: 'Growth',
      duplicateSearchTerms: ['smartphone', 'penetration'],
    },
    {
      matchTerms: ['recharge', 'growth trends', 'm-pesa', 'voucher'],
      epicTitle: 'FY27 Q1 – DMS – NBA – Recharge Growth Trends',
      month: 'May',
      theme: 'Growth',
      duplicateSearchTerms: ['recharge', 'float'],
    },
    {
      matchTerms: ['css', 'site performance', 'visualization'],
      epicTitle: 'FY27 Q1 – DMS – CSS – Site Performance Visualization',
      month: 'May',
      theme: 'Simplicity',
      duplicateSearchTerms: ['css', 'site performance'],
    },
    {
      matchTerms: ['fl productivity', 'active fl', 'freelancer'],
      epicTitle: 'FY27 Q1 – DMS – NBA – FL Productivity and Active FL',
      month: 'June',
      theme: 'Growth',
      duplicateSearchTerms: ['fl productivity', 'active fl'],
    },
    {
      matchTerms: ['navigation search'],
      epicTitle: 'FY27 Q1 – DMS – NBA – Navigation Search',
      month: 'June',
      theme: 'Simplicity',
      duplicateSearchTerms: ['navigation search'],
    },
  ],
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
  'FIN:FY27 Q2': [
    {
      matchTerms: ['base rate', 'base rate management'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – Contract Management – Base Rate Management',
      month: 'July',
      module: 'Contract Management',
      theme: 'Contract Management',
      duplicateSearchTerms: ['base rate'],
    },
    {
      matchTerms: ['allowances', 'allowances input'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – Contract Management – Allowances Input',
      month: 'July',
      module: 'Contract Management',
      theme: 'Contract Management',
      duplicateSearchTerms: ['allowances'],
    },
    {
      matchTerms: ['excess', 'excess computation'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – Contract Management – Excess Computation',
      month: 'July',
      module: 'Contract Management',
      theme: 'Contract Management',
      duplicateSearchTerms: ['excess'],
    },
    {
      matchTerms: ['escalation', 'escalation computation'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – Contract Management – Escalation Computation',
      month: 'July',
      module: 'Contract Management',
      theme: 'Contract Management',
      duplicateSearchTerms: ['escalation'],
    },
    {
      matchTerms: ['milestone', 'milestone computation'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – Contract Management – Milestone Computation',
      month: 'July',
      module: 'Contract Management',
      theme: 'Contract Management',
      duplicateSearchTerms: ['milestone'],
    },
    {
      matchTerms: ['site creation', 'itp and rfi', 'rfi'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – ITP & Change Management – Site Creation Using ITP And RFI',
      month: 'July',
      module: 'ITP & Change Management',
      theme: 'ITP & Change Management',
      duplicateSearchTerms: ['site creation', 'itp', 'rfi'],
    },
    {
      matchTerms: ['approval hierarchy', 'configuration of approval'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – ITP & Change Management – Configuration Of Approval Hierarchy',
      month: 'July',
      module: 'ITP & Change Management',
      theme: 'ITP & Change Management',
      duplicateSearchTerms: ['approval hierarchy'],
    },
    {
      matchTerms: ['linking itp', 'site records'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – ITP & Change Management – Linking ITP Changes To Specific Site Records',
      month: 'July',
      module: 'ITP & Change Management',
      theme: 'ITP & Change Management',
      duplicateSearchTerms: ['linking itp', 'site records'],
    },
    {
      matchTerms: ['dashboards', 'monitoring changes'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – ITP & Change Management – Dashboards For Monitoring Changes',
      month: 'July',
      module: 'ITP & Change Management',
      theme: 'ITP & Change Management',
      duplicateSearchTerms: ['dashboards', 'monitoring changes'],
    },
    {
      matchTerms: ['billing logic', 'define billing'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – Billing Reconciliation – Define Billing Logic',
      month: 'August',
      module: 'Billing Reconciliation',
      theme: 'Billing Reconciliation',
      duplicateSearchTerms: ['billing logic'],
    },
    {
      matchTerms: ['expected costs', 'generate expected'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – Billing Reconciliation – Generate Expected Costs',
      month: 'August',
      module: 'Billing Reconciliation',
      theme: 'Billing Reconciliation',
      duplicateSearchTerms: ['expected costs'],
    },
    {
      matchTerms: ['invoice reconciliation', '3rd party', 'third party'],
      epicTitle: 'FY27 Q2 – FIN – TOWERCO – Billing Reconciliation – Invoice Reconciliation With 3rd Party',
      month: 'September',
      module: 'Billing Reconciliation',
      theme: 'Billing Reconciliation',
      duplicateSearchTerms: ['invoice reconciliation', '3rd party'],
    },
  ],
});

export function commitmentLabel(row = {}) {
  return [row.deliveryItem, row.module, row.theme, row.bullet, row.title].filter(Boolean).join(' ');
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
