export type CategoryGroup = "profession" | "body" | "work" | "other";
export type GoalType = "profession" | "body" | "market" | "custom";
export type GoalStatus = "active" | "done" | "paused";
export type DayStatusKey = "red" | "yellow" | "green" | "combat";
export type QuickMetricKind = "number" | "boolean" | "text";

export type TimerCategory = {
  id: string;
  name: string;
  group: CategoryGroup;
  description: string;
  system?: boolean;
};

export type DayRecord = {
  userId?: string;
  date: string;
  calories?: number;
  basalMetabolismKcal?: number;
  proteinGrams?: number;
  activeKcal?: number;
  steps?: number;
  weightKg?: number;
  sleepHours?: number;
  alcohol?: boolean;
  binge?: boolean;
  workout?: boolean;
  nutritionInRange?: boolean;
  workBefore1730Opened?: boolean;
  energy?: number;
  note?: string;
  artifact?: string;
  reflection?: string;
  points?: number;
  statusKey?: DayStatusKey;
  closedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TimeEntry = {
  id: string;
  userId: string;
  date: string;
  categoryId: string;
  category: string;
  group: CategoryGroup;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  createdAt: string;
};

export type Goal = {
  id: string;
  userId?: string;
  title: string;
  type: GoalType;
  targetValue: number;
  currentValue: number;
  deadline: string;
  status: GoalStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type ActiveTimer = {
  categoryId: string;
  startedAt: string;
};

export type Period = {
  label: string;
  from?: string;
  to?: string;
};

export type DayScore = {
  points: number;
  professionPoints: number;
  bodyPoints: number;
  statusKey: DayStatusKey;
  statusLabel: string;
  statusClass: string;
  reasons: string[];
};

export type QuickMetricDefinition = {
  id: string;
  field: keyof DayRecord;
  label: string;
  kind: QuickMetricKind;
  min?: string;
  max?: string;
  step?: string;
};

export type AppSettings = {
  timerCategories: TimerCategory[];
  visibleMetricIds: string[];
  createdAt?: string;
  updatedAt?: string;
};
