/**
 * Canonical project catalog (aligned with Report page squads).
 */
export const PROJECT_CATALOG = [
  { key: 'MPSA', label: 'M-SQUAD', entityType: 'delivery-squad', scoreable: true, defaultSelected: true },
  { key: 'MAS', label: 'Mini - Apps Squad', entityType: 'delivery-squad', scoreable: true, defaultSelected: true },
  { key: 'RPA', label: 'Robotics Process Automation (RPA)', entityType: 'delivery-squad', scoreable: true, defaultSelected: false },
  { key: 'MVA', label: 'Digital Squad', entityType: 'delivery-squad', scoreable: true, defaultSelected: false },
  { key: 'ASG', label: 'Agile and Security Guild', entityType: 'operational-guild', scoreable: false, defaultSelected: false },
  { key: 'FIN', label: 'Finance Squad', entityType: 'delivery-squad', scoreable: true, defaultSelected: false },
  { key: 'SD', label: 'DMS Squad (Kilimanjaro Legends)', entityType: 'delivery-squad', scoreable: true, defaultSelected: false },
  { key: 'MPSA2', label: 'TRANSFORMERS', entityType: 'delivery-squad', scoreable: true, defaultSelected: false },
  { key: 'TRS', label: 'T-Squad', entityType: 'delivery-squad', scoreable: true, defaultSelected: false },
  { key: 'VB', label: 'Vodacom Business', entityType: 'delivery-squad', scoreable: true, defaultSelected: false },
  { key: 'AMS2', label: 'AMS Squad (Tachyons)', entityType: 'delivery-squad', scoreable: true, defaultSelected: false },
  { key: 'BIO', label: 'Bio metric KYC & KYA', entityType: 'delivery-squad', scoreable: true, defaultSelected: false },
];

export function readCatalogKeys() {
  return PROJECT_CATALOG.map((p) => p.key);
}

export function defaultSelectedKeys() {
  return PROJECT_CATALOG.filter((p) => p.defaultSelected).map((p) => p.key);
}

export function catalogEntry(key) {
  const k = String(key || '').trim().toUpperCase();
  return PROJECT_CATALOG.find((p) => p.key === k) || null;
}

export function isDeliverySquad(key) {
  const entry = catalogEntry(key);
  return entry ? entry.entityType === 'delivery-squad' && entry.scoreable !== false : true;
}

export function deliverySquadKeys() {
  return PROJECT_CATALOG.filter((p) => isDeliverySquad(p.key)).map((p) => p.key);
}

export function operationalEntityKeys() {
  return PROJECT_CATALOG.filter((p) => !isDeliverySquad(p.key)).map((p) => p.key);
}
