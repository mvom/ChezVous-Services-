// ── App-wide constants & service configuration ───────────────────────────────

export const API_BASE = "http://localhost:8000/api/v1";
export const TOKEN_KEY = "sm_token";
export const DEMANDE_DRAFT_KEY = "sm_last_demande_draft";
export const THEME_PREF_KEY_PREFIX = "sm_theme_pref";
export const HIDDEN_ADMIN_PATH = "/_staff/console";
export const TOKEN_REFRESH_SKEW_SECONDS = 90;
export const MODAL_CLOSE_MS = 180;
export const AVATAR_CROP_VIEW_SIZE = 320;
export const AVATAR_EXPORT_SIZE = 1024;

export type SubServiceOption = { value: string; label: string };
export type SubServiceGroup = { title: string; options: SubServiceOption[] };
export type SubServiceConfig = { groups: SubServiceGroup[] };

export const SUB_SERVICES_CONFIG: Record<string, SubServiceConfig> = {
  menage: {
    groups: [
      {
        title: "",
        options: [
          { value: "nettoyage_maison", label: "🏠 Nettoyage maison" },
          { value: "lessive", label: "👕 Lessive" },
          { value: "repassage", label: "👔 Repassage" },
          { value: "vaisselle", label: "🍽️ Vaisselle" },
          { value: "baby_sitting", label: "👶 Baby-sitting" },
        ],
      },
    ],
  },
  evenementiel: {
    groups: [
      {
        title: "🪑 Location matériel",
        options: [
          { value: "loc_chaises", label: "Chaises" },
          { value: "loc_baches_tentes", label: "Bâches / Tentes" },
          { value: "loc_tables", label: "Tables" },
          { value: "loc_plats", label: "Plats" },
        ],
      },
      {
        title: "🎤 Animation",
        options: [
          { value: "anim_dj", label: "DJ" },
          { value: "anim_mc", label: "MC (maître de cérémonie)" },
          { value: "anim_photographe", label: "Photographe" },
          { value: "anim_vidéaste", label: "Vidéaste" },
        ],
      },
    ],
  },
  reparation_electronique: {
    groups: [
      {
        title: "",
        options: [
          { value: "elec_telephone", label: "📱 Téléphone" },
          { value: "elec_television", label: "📺 Télévision" },
          { value: "elec_ordinateur", label: "💻 Ordinateur" },
          { value: "elec_tablette", label: "Tablette" },
          { value: "elec_autre", label: "Autres appareils (à préciser)" },
        ],
      },
    ],
  },
  climatisation: {
    groups: [
      {
        title: "",
        options: [
          { value: "clim_congelateur", label: "Congélateur" },
          { value: "clim_frigo", label: "Frigo" },
          { value: "clim_climatiseur", label: "Climatiseur" },
        ],
      },
    ],
  },
};

export const allCategories = [
  "menage",
  "plomberie",
  "electricite",
  "mecanique_auto",
  "soudure",
  "evenementiel",
  "reparation_electronique",
  "climatisation",
] as const;
