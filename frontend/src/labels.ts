// Libellés français centralisés — source unique de vérité pour l'UI

export const STATUS_LABELS: Record<string, string> = {
  ouverte: "Ouverte",
  attribuee: "Attribuée",
  annulee: "Annulée",
  expiree: "Expirée",
  en_attente: "En attente",
  acceptee: "Acceptée",
  confirmee: "Confirmée",
  en_cours: "En cours",
  terminee: "Terminée",
  litige: "Litige",
};

export const PRIORITY_LABELS: Record<string, string> = {
  haute: "Urgente",
  normale: "Normale",
  basse: "Basse",
};

export const PRIORITY_CLASSES: Record<string, string> = {
  haute: "priority-badge priority-haute",
  normale: "priority-badge priority-normale",
  basse: "priority-badge priority-basse",
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  flexible: "Flexible",
  fixe: "Planning fixe",
};

export const EVENT_TEXT: Record<string, string> = {
  cree: "Demande créée",
  attribuee: "Demande attribuée",
  en_cours: "Mission en cours",
  terminee: "Mission terminée",
};

export const STEP_LABELS: Record<string, string> = {
  publiee: "Publiée",
  attribuee: "Attribuée",
  en_cours: "En cours",
  terminee: "Terminée",
  notee: "Notée",
};
