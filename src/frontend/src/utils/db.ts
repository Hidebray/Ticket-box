import Dexie, { type Table } from 'dexie';

export interface Ticket {
  id: string;
  qr_code: string;
  status: string; // 'SOLD', 'CHECKED_IN'
  scanned_at?: string | null;
}

export interface SyncQueueItem {
  ticketId: string;
  scannedAt: string;
}

export class CheckInDB extends Dexie {
  tickets!: Table<Ticket, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('TicketBoxCheckInDB');
    this.version(1).stores({
      tickets: 'id, qr_code, status', // Primary key and indexed props
      syncQueue: 'ticketId' // Primary key
    });
  }
}

export const db = new CheckInDB();
