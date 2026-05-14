import { useCallback } from "react";
import type { NavigateFunction } from "react-router-dom";
import type {
  AtRiskResponse,
  AuthRolesResponse,
  BadgeRecord,
  Demande,
  JwtClaims,
  LoyaltyStats,
  Mission,
  PrestataireRecord,
  Role,
  Service,
  ToastState,
  UserRecord,
  ZoneNotification,
} from "./types";

function compareDemandesByRecencyDesc(a: Demande, b: Demande): number {
  const left = Date.parse(a.created_at);
  const right = Date.parse(b.created_at);
  const timeDelta = (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
  return timeDelta !== 0 ? timeDelta : b.id - a.id;
}

type UseRefreshDashboardDeps = {
  apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
  navigate: NavigateFunction;
  roleHomePath: (role?: Role) => string;
  normalizeAvailableRoles: (raw: Role[] | undefined, fallbackRole?: Role) => Role[];
  setClaims: (claims: JwtClaims | null) => void;
  setAvailableRoles: (roles: Role[]) => void;
  setDashboardPending: (value: boolean) => void;
  setToast: (toast: ToastState) => void;
  setDemandes: (value: Demande[]) => void;
  setServices: (value: Service[]) => void;
  setMissions: (value: Mission[]) => void;
  setUsers: (value: UserRecord[]) => void;
  setPrestataires: (value: PrestataireRecord[]) => void;
  setVisibilityMode: (value: "public" | "discret" | "anonyme") => void;
  setZonePrefVille: (value: string) => void;
  setZonePrefArrondissement: (value: string) => void;
  setZonePrefQuartier: (value: string) => void;
  setZoneNotifications: (value: ZoneNotification[]) => void;
  setClientLoyalty: (value: LoyaltyStats | null) => void;
  setUserBadges: (value: BadgeRecord[]) => void;
  setAdminAtRisk: (value: AtRiskResponse | null) => void;
  loadClientMatchingPreview: (demandeId: number) => Promise<void>;
  fetchUserProfile: () => Promise<void>;
};

export function useRefreshDashboard({
  apiFetch,
  navigate,
  roleHomePath,
  normalizeAvailableRoles,
  setClaims,
  setAvailableRoles,
  setDashboardPending,
  setToast,
  setDemandes,
  setServices,
  setMissions,
  setUsers,
  setPrestataires,
  setVisibilityMode,
  setZonePrefVille,
  setZonePrefArrondissement,
  setZonePrefQuartier,
  setZoneNotifications,
  setClientLoyalty,
  setUserBadges,
  setAdminAtRisk,
  loadClientMatchingPreview,
  fetchUserProfile,
}: UseRefreshDashboardDeps) {
  const refreshDashboard = useCallback(
    async function refreshDashboard(nextClaims: JwtClaims) {
      if (!nextClaims.sub) {
        return;
      }

      try {
        setDashboardPending(true);
        const [
          nextDemandes,
          nextServices,
          nextMissions,
          nextUsers,
          nextPrestataires,
          nextLoyalty,
          nextBadges,
          nextAtRisk,
          rolesPayload,
        ] = await Promise.all([
          apiFetch<Demande[]>("/demandes"),
          apiFetch<Service[]>("/services"),
          apiFetch<Mission[]>("/missions"),
          nextClaims.role === "admin"
            ? apiFetch<UserRecord[]>("/auth/users")
            : Promise.resolve([] as UserRecord[]),
          nextClaims.role === "admin"
            ? apiFetch<PrestataireRecord[]>("/prestataires")
            : Promise.resolve([] as PrestataireRecord[]),
          nextClaims.role === "client"
            ? apiFetch<LoyaltyStats>("/auth/me/loyalty")
            : Promise.resolve(null),
          nextClaims.role === "client" || nextClaims.role === "prestataire"
            ? apiFetch<BadgeRecord[]>("/auth/me/badges")
            : Promise.resolve([] as BadgeRecord[]),
          nextClaims.role === "admin"
            ? apiFetch<AtRiskResponse>("/missions/at-risk").catch(() => null)
            : Promise.resolve(null),
          apiFetch<AuthRolesResponse>("/auth/me/roles").catch(() => null),
        ]);

        const sortedDemandes = [...nextDemandes].sort(compareDemandesByRecencyDesc);

        setDemandes(sortedDemandes);
        setServices(nextServices);
        setMissions(nextMissions);
        setUsers(nextUsers);
        setPrestataires(nextPrestataires);

        if (nextClaims.role === "prestataire") {
          const myRecord = nextPrestataires.find((p) => p.user_id === Number(nextClaims.sub));
          if (myRecord?.visibility_mode) setVisibilityMode(myRecord.visibility_mode);
          try {
            const [ownPrestataires, notifs] = await Promise.all([
              apiFetch<PrestataireRecord[]>("/prestataires"),
              apiFetch<ZoneNotification[]>("/prestataires/me/notifications"),
            ]);
            const own = ownPrestataires.find((p) => p.user_id === Number(nextClaims.sub));
            if (own) {
              if (own.visibility_mode) setVisibilityMode(own.visibility_mode);
              setZonePrefVille(own.zone_preference_ville ?? "");
              setZonePrefArrondissement(own.zone_preference_arrondissement ?? "");
              setZonePrefQuartier(own.zone_preference_quartier ?? "");
            }
            setZoneNotifications(notifs);
          } catch {
            // non-blocking
          }
        }

        setClientLoyalty(nextLoyalty);
        setUserBadges(nextBadges);
        setAdminAtRisk(nextAtRisk);
        setAvailableRoles(normalizeAvailableRoles(rolesPayload?.available_roles, nextClaims.role));

        if (nextClaims.role === "client") {
          const ownOpenDemandes = sortedDemandes
            .filter((d) => d.client_id === Number(nextClaims.sub) && d.status === "ouverte")
            .sort(compareDemandesByRecencyDesc);
          const recentOpenDemande = ownOpenDemandes[0];
          if (recentOpenDemande) {
            void loadClientMatchingPreview(recentOpenDemande.id);
          }
        }

        navigate(roleHomePath(nextClaims.role), { replace: true });
        void fetchUserProfile();
      } catch (error) {
        setClaims(null);
        setToast({ kind: "err", message: error instanceof Error ? error.message : "Session expirée" });
      } finally {
        setDashboardPending(false);
      }
    },
    [
      apiFetch,
      navigate,
      roleHomePath,
      normalizeAvailableRoles,
      setClaims,
      setAvailableRoles,
      setDashboardPending,
      setToast,
      setDemandes,
      setServices,
      setMissions,
      setUsers,
      setPrestataires,
      setVisibilityMode,
      setZonePrefVille,
      setZonePrefArrondissement,
      setZonePrefQuartier,
      setZoneNotifications,
      setClientLoyalty,
      setUserBadges,
      setAdminAtRisk,
      loadClientMatchingPreview,
      fetchUserProfile,
    ]
  );

  return { refreshDashboard };
}
