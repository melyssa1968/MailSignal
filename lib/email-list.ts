export type EmailListItem = {
  id: string;
  sender?: string | null;
  recipients: string[];
  subject: string;
  status: string;
  opens: number;
  uncertain: number;
  loads: number;
  sent_at: number;
  last_request: number | null;
};

export type EmailSort = 'sent-newest' | 'request-newest' | 'request-oldest';
export type TrackingFilter = 'all' | 'active' | 'paused';
export const senderKey = (email: EmailListItem) => email.sender?.trim().toLowerCase() || '';
export const senderLabel = (sender: string) => sender || 'Sender not recorded';

export function selectEmails<T extends EmailListItem>(rows: T[], options: {
  search: string; activity: string; sender: string; tracking: TrackingFilter; sort: EmailSort;
}): T[] {
  const query = options.search.trim().toLowerCase();
  return rows.filter(email =>
    (email.recipients.join(' ') + ' ' + email.subject + ' ' + senderKey(email)).toLowerCase().includes(query)
    && (options.activity === 'all' || (options.activity === 'opened' ? email.opens > 0 : options.activity === 'uncertain' ? email.uncertain > 0 : email.loads === 0))
    && (options.sender === 'all' || senderKey(email) === options.sender)
    && (options.tracking === 'all' || email.status === options.tracking)
  ).sort((a, b) => {
    const fallback = b.sent_at - a.sent_at || a.id.localeCompare(b.id);
    if (options.sort === 'sent-newest') return fallback;
    // Emails without a recorded request stay at the bottom in either direction.
    if (a.last_request == null) return b.last_request == null ? fallback : 1;
    if (b.last_request == null) return -1;
    return (options.sort === 'request-newest' ? b.last_request - a.last_request : a.last_request - b.last_request) || fallback;
  });
}

export function groupEmails<T extends EmailListItem>(rows: T[], bySender: boolean): {sender: string | null; emails: T[]}[] {
  if (!bySender) return [{sender: null, emails: rows}];
  const groups = new Map<string, T[]>();
  for (const email of rows) {
    const key = senderKey(email);
    const group = groups.get(key) || [];
    group.push(email);
    groups.set(key, group);
  }
  return [...groups].sort(([a], [b]) => a === '' ? 1 : b === '' ? -1 : a.localeCompare(b))
    .map(([sender, emails]) => ({sender, emails}));
}
