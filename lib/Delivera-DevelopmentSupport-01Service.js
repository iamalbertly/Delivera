export function labelDevelopmentSupportRecord(record = {}) {
  return {
    ...record,
    class: 'career_evidence_workspace',
    disclaimer: 'Development support in Delivera is not an official HR system of record.',
    officialHrReference: false,
  };
}

