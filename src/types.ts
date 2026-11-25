export type SectionKey =
  | 'DASHBOARD'
  | 'PLAYERS'
  | 'STATS'
  | 'MONEY'
  | 'GOOGLE'
  | 'COMMITTEE'
  | 'AWARDS'
  | 'ACTIVITY';

export type PlayerPosition =
  | 'Goalkeeper'
  | 'Defender'
  | 'Midfielder'
  | 'Forward'
  | 'Winger';

export type PlayerStatus = 'Active' | 'Injured' | 'Suspended' | 'Inactive';

export interface AdminUser {
  username: string;
  displayName: string;
}

export interface AuthStatus {
  configured: boolean;
  envOverride: boolean;
  authenticated: boolean;
  admin: AdminUser | null;
}

export interface Player {
  id: number;
  player_code: string;
  full_name: string;
  photo_url: string;
  age: number;
  date_of_birth: string;
  phone: string;
  address: string;
  position: PlayerPosition;
  joining_date: string;
  status: PlayerStatus;
  created_at: string;
  updated_at: string;
}

export interface PlayerStatTotals {
  player_id: number;
  matches_played: number;
  goals: number;
  assists: number;
  wins: number;
  losses: number;
  draws: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheets: number;
  saves: number;
  goals_conceded: number;
  avg_attendance: number;
  avg_rating: number;
  record_count: number;
}

export interface PlayerStatRecord {
  id: number;
  player_id: number;
  player_name?: string;
  player_code?: string;
  player_photo?: string;
  match_id: number | null;
  opponent?: string | null;
  record_date: string;
  record_label: string;
  matches_played: number;
  goals: number;
  assists: number;
  wins: number;
  losses: number;
  draws: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheets: number;
  saves: number;
  goals_conceded: number;
  attendance: number;
  performance_rating: number;
  custom_stats: string;
  created_at: string;
}

export interface MatchRecord {
  id: number;
  match_date: string;
  opponent: string;
  competition: string;
  venue: string;
  kuc_score: number;
  opponent_score: number;
  result: 'Win' | 'Loss' | 'Draw';
  notes: string;
  created_at: string;
}

export interface WeeklyPayment {
  id: number;
  player_id: number;
  player_code: string;
  full_name: string;
  photo_url: string;
  position: string;
  player_status: string;
  week_start: string;
  week_label: string;
  amount: number;
  status: 'PAID' | 'UNPAID';
  paid_at: string | null;
  created_at: string;
}

export interface FinancialTransaction {
  id: number;
  player_id: number | null;
  player_name?: string | null;
  player_code?: string | null;
  payment_id: number | null;
  tx_type: 'WEEKLY_CONTRIBUTION' | 'EXPENSE' | 'SPONSORSHIP' | 'OTHER_INCOME';
  amount: number;
  direction: 'IN' | 'OUT';
  description: string;
  tx_date: string;
  created_at: string;
}

export interface CommitteeMember {
  id: number;
  committee_id: number;
  player_id: number;
  position: string;
  full_name: string;
  player_code: string;
  photo_url: string;
  player_position: string;
  assigned_at: string;
}

export interface Committee {
  id: number;
  year: number;
  title: string;
  is_current: number;
  notes: string;
  created_at: string;
  members: CommitteeMember[];
}

export type AwardCategory = 'GOLDEN_BALL' | 'GOLDEN_BOOT' | 'GOLDEN_GLOVES';
export type AwardPeriodType = 'ANNUAL' | 'H1' | 'H2';

export interface AwardYear {
  id: number;
  year: number;
  title: string;
  is_active: number;
  started_by: string;
  started_at: string;
}

export interface AwardRecord {
  id: number;
  category: AwardCategory;
  period_type: AwardPeriodType;
  award_year: number;
  player_id: number;
  player_name: string;
  player_code: string;
  player_photo: string;
  player_position: string;
  winner_photo_url: string;
  reason: string;
  performance_details: string;
  goals_scored: number;
  clean_sheets: number;
  saves: number;
  goals_conceded: number;
  published: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  category: string;
  details: string;
  actor: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
}

export interface ActivityLogsResponse {
  logs: ActivityLog[];
  total: number;
  todayCount: number;
  categoryCounts: Record<string, number>;
}

export interface DashboardSummary {
  playerCount: number;
  activePlayerCount: number;
  hasPlayers: boolean;
  totalMoney: number;
  weeklyExpected: number;
  weeklyCollected: number;
  currentCommittee: Committee | null;
  recentActivities: ActivityLog[];
  latestAwards: AwardRecord[];
}

export interface InternalSearchResult {
  id: string;
  category:
    | 'Players'
    | 'Player IDs'
    | 'Player Statistics'
    | 'Money Records'
    | 'Payment History'
    | 'Committee Members'
    | 'Previous Committees'
    | 'Club Records';
  title: string;
  subtitle: string;
  meta: string;
  targetSection: SectionKey;
  entityId?: number;
}
