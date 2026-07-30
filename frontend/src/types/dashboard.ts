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
}
