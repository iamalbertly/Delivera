import { risksToAttentionItems, renderAttentionQueueTable } from './Delivera-Shared-Attention-Queue.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

export function renderBriefAttentionQueue(brief) {
  const items = risksToAttentionItems(brief);
  return renderAttentionQueueTable({ title: COPY.attentionQueue, items, maxRows: 8 });
}
