export type Role = "location" | "kitchen" | "manager" | "admin";

export type LocationType = "school" | "daycare";

export type DemandStatus = "draft" | "confirmed" | "changed" | "late" | "missing";

export type Confidence = "high" | "medium" | "low";

export const SPECIAL_DIETS = ["lactoseFree", "glutenFree", "vegetarian", "allergy"] as const;
export type SpecialDiet = (typeof SPECIAL_DIETS)[number];
export type SpecialCounts = Record<SpecialDiet, number>;

export const VARIANCE_REASONS = [
  "Late absence information",
  "Unreported absences",
  "Unexpected extra diners",
  "Production buffer",
  "Menu acceptance",
  "Trip or event not reported",
  "Other",
] as const;
export type VarianceReason = (typeof VARIANCE_REASONS)[number];

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  normalCapacity: number;
  contact: string;
}

export interface MealPlan {
  date: string; // YYYY-MM-DD
  mealName: string;
}

export interface DemandRecord {
  id: string;
  date: string;
  locationId: string;
  expectedCount: number; // registered / expected population for the day
  absenceCount: number;
  specialCounts: SpecialCounts;
  /** true once the location has confirmed at least once */
  confirmed: boolean;
  confirmedAt: string | null; // first confirmation, local "YYYY-MM-DDTHH:mm"
  updatedAt: string | null;
  updatedByRole: Role | null;
  changedAfterConfirm: boolean;
}

export interface ChangeLog {
  id: string;
  recordId: string;
  date: string;
  locationId: string;
  field: "count" | "confirm";
  previousValue: { expected: number; absences: number } | null;
  newValue: { expected: number; absences: number };
  reason: string | null;
  timestamp: string;
  role: Role;
  afterDeadline: boolean;
}

export interface ProductionPlan {
  date: string;
  totalRecommended: number;
  totalApproved: number;
  adjustmentReason: string | null;
  approvedBy: string;
  approvedAt: string;
  /** location -> planned meals, frozen at approval */
  allocations: Record<string, number>;
  /** location -> diner forecast used at approval (for accuracy analytics) */
  forecasts: Record<string, number>;
  /** location -> status at approval time */
  statuses: Record<string, DemandStatus>;
}

export interface ServiceActual {
  id: string;
  date: string;
  locationId: string;
  produced: number;
  served: number;
  surplus: number;
  wasteKg: number;
  reason: VarianceReason | null;
  note: string | null;
  recordedAt: string;
}

export interface Settings {
  deadlines: Record<LocationType, string>; // "HH:mm" on the previous working day
  bufferPercent: number;
  materialChangeThreshold: number; // meals; changes larger than this need a reason
  varianceThreshold: number; // meals; actual variance larger than this needs a reason
  useHistoricalAdjustment: boolean;
  clockMode: "simulated" | "real";
  simulatedNow: string; // "YYYY-MM-DDTHH:mm"
}

export interface Database {
  version: number;
  seededAt: string;
  locations: Location[];
  mealPlans: MealPlan[];
  demand: DemandRecord[];
  changeLog: ChangeLog[];
  plans: ProductionPlan[];
  actuals: ServiceActual[];
  settings: Settings;
}

/* ---------- derived view models ---------- */

export interface LocationDemandView {
  location: Location;
  record: DemandRecord;
  status: DemandStatus;
  deadline: string;
  minutesToDeadline: number;
  /** diners after absences, before adjustment */
  netDiners: number;
  /** true if netDiners came from a location confirmation, false if estimated */
  isEstimate: boolean;
  estimateBasis: string | null;
  historicalAdjustment: number;
  historyObservations: number;
  forecast: number; // netDiners + adjustment
  buffer: number;
  recommended: number;
  confidence: Confidence;
  specialTotal: number;
  lastChange: ChangeLog | null;
}

export interface KitchenSnapshot {
  now: string;
  serviceDate: string;
  meal: MealPlan | null;
  rows: LocationDemandView[];
  totals: {
    expectedPopulation: number;
    absences: number;
    netDiners: number;
    confirmedDiners: number;
    estimatedDiners: number;
    adjustment: number;
    buffer: number;
    recommended: number;
    special: SpecialCounts;
  };
  counts: Record<DemandStatus, number>;
  confidence: Confidence;
  explanation: string;
  plan: ProductionPlan | null;
  settings: Settings;
}
