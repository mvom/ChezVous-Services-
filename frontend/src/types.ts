// ── Shared types ────────────────────────────────────────────────────────────
/* v8 ignore file */

export type Role = "client" | "prestataire" | "admin";

export type JwtClaims = {
  sub?: string;
  role?: Role;
  username?: string;
  exp?: number;
};

export type UserProfile = {
  username: string;
  avatar_url: string | null;
};

export type UserRecord = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  address: string;
  phone: string;
  role: Role;
  avatar_url?: string | null;
};

export type PrestataireRecord = {
  user_id: number;
  rating: number;
  verified: boolean;
  visibility_mode?: "public" | "discret" | "anonyme";
  zone_preference_ville?: string | null;
  zone_preference_arrondissement?: string | null;
  zone_preference_quartier?: string | null;
};

export type ZoneNotification = {
  id: number;
  demande_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  active_role?: Role;
  available_roles?: Role[];
};

export type AuthRolesResponse = {
  active_role: Role;
  available_roles: Role[];
};

export type SessionResponse = {
  sub: string;
  role: Role;
  username: string;
  exp: number;
  active_role: Role;
  available_roles: Role[];
};

export type DemandeCategory =
  | "menage"
  | "plomberie"
  | "electricite"
  | "mecanique_auto"
  | "soudure"
  | "evenementiel"
  | "reparation_electronique"
  | "climatisation";

export type Demande = {
  id: number;
  client_id: number;
  category: DemandeCategory;
  status: string;
  priority: string;
  description: string;
  location: string;
  ville?: string | null;
  arrondissement?: string | null;
  quartier?: string | null;
  client_availability_mode?: string;
  client_availability_note?: string | null;
  sub_services?: string[] | null;
  created_at: string;
  updated_at: string;
  events: DemandeEvent[];
};

export type DemandeEvent = {
  id: number;
  event_type: string;
  previous_status?: string | null;
  new_status?: string | null;
  actor_user_id?: number | null;
  actor_label?: string | null;
  created_at: string;
};

export type Service = {
  id: number;
  prestataire_id: number;
  name: string;
  description: string;
  availability_slots: string;
  price: number | null;
  created_at: string;
  updated_at: string;
};

export type PrestataireTrust = {
  verified: boolean;
  rating: number;
  completed_missions: number;
  total_missions: number;
  average_response_minutes?: number | null;
  eta_reliability_percent: number;
};

export type PrestataireMissionSummary = {
  user_id: number;
  display_name: string;
  avatar_url?: string | null;
  trust: PrestataireTrust;
};

export type Mission = {
  id: number;
  demande_id: number;
  client_id: number;
  prestataire_id: number;
  service_id?: number | null;
  status: string;
  scheduled_at?: string | null;
  created_at: string;
  updated_at: string;
  prestataire_summary?: PrestataireMissionSummary | null;
};

export type MatchingCandidate = {
  user_id: number;
  display_name: string;
  avatar_url?: string | null;
  trust: PrestataireTrust;
  score_total: number;
  score_zone: number;
  score_rating: number;
  score_completion: number;
  score_response: number;
  distance_km?: number | null;
};

export type MatchingResult = {
  demande_id: number;
  available_count: number;
  candidates: MatchingCandidate[];
};

export type LoyaltyStats = {
  loyalty_points: number;
  completed_missions_count: number;
  next_milestone: number;
  progress_percent: number;
};

export type BadgeRecord = {
  id: number;
  user_id: number;
  slug: string;
  awarded_at: string;
};

export type AtRiskMission = {
  mission_id: number;
  demande_id: number;
  client_id: number;
  prestataire_id: number;
  scheduled_at?: string | null;
};

export type AtRiskResponse = {
  status: string;
  checked_at: string;
  threshold_at: string;
  count: number;
  missions: AtRiskMission[];
};

export type ToastState = {
  kind: "ok" | "err";
  message: string;
} | null;

export type AuthMode = "login" | "register";
export type ThemeMode = "violet" | "rose";

export type ClientStatusFilter = "all" | "ouverte" | "attribuee" | "annulee" | "expiree";
export type PrestataireStatusFilter = "all" | "ouverte" | "attribuee";
export type AvatarCropTarget = "profile" | "register";
export type PipelineCardFilter = "all" | "urgent" | "scheduled";
export type AvailabilityMode = "flexible" | "fixe";

export type EditDemandeDraft = {
  category: DemandeCategory;
  description: string;
  ville: string;
  arrondissement: string;
  quartier: string;
  client_availability_mode: AvailabilityMode;
  client_availability_note: string;
  priority: string;
  sub_services: string[];
};

export type DemandeStepBadge = {
  key: "publiee" | "attribuee" | "en_cours" | "terminee" | "notee";
  label: string;
};
