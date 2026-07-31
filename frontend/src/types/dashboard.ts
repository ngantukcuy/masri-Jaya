export interface Activity {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  time: string;
  /** Real ISO timestamp of when this happened — `time` above is kept only
   * as a fallback label for old records saved before this field existed;
   * anything that renders this activity should compute a live relative
   * time ("5 menit lalu") from `createdAt` when it's present. */
  createdAt?: string;
  type: 'sale' | 'arrival' | 'overdue' | 'quote';
  /**
   * Who should see this activity in the notification bell.
   * - 'all' (default when omitted) — every logged-in account, any role.
   * - 'approvers' — only accounts holding at least one "approve" permission
   *   (manage_retur_approve, manage_finance_approve, manage_opname_approve,
   *   manage_purchase_approve — see lib/permissions.ts). Used for "waiting
   *   for approval" events (new retur/PO/opname submission, reimbursement
   *   claim) so operational staff (Kasir/Stoker) don't see them until
   *   they're resolved — the approve/reject outcome itself is then logged
   *   as a separate 'all' activity so staff finds out once it's decided.
   */
  audience?: 'all' | 'approvers';
}
