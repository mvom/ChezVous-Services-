/**
 * Tests unitaires pour les fonctions pures de utils.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanGeo,
  demandeGeoLabel,
  clientAvailabilityLabel,
  themeStorageKey,
  readThemePreference,
  decodeJwt,
  isTokenExpired,
  shouldActualiserToken,
  authHeaders,
  roleHomePath,
  formatCameroonPhone,
  normalizePersonName,
  userFacingError,
  formatDateTime,
  demandeStatusTone,
  demandeStatusLabel,
  statusChipClass,
  formatStatusLabel,
  demandeEventText,
  demandeEventStepBadge,
  demandeEventActor,
  priorityLabel,
  priorityClass,
  demandeCategoryLabel,
  formatServicePrice,
  groupEventsByDay,
  missionPipelineStatus,
  demandeProgressIndex,
  demandeProgressSteps,
  formatResponseDelay,
  etaReliabilityLabel,
  trustBadgeTone,
  badgeLabel,
  scoreBarClass,
  initialsFromText,
  dateRefPart,
  demandRef,
  initialsFromActorLabel,
  prestataireTrustProps,
} from "./utils";
import type { PrestataireMissionSummary } from "./types";
import type { Demande, DemandeEvent } from "./types";

// ── Minimal test fixtures ─────────────────────────────────────────────────────

function makeDemande(overrides: Partial<Demande> = {}): Demande {
  return {
    id: 1,
    client_id: 1,
    status: "ouverte",
    description: "Test",
    category: "menage",
    priority: "normale",
    ville: "Douala",
    arrondissement: "Douala 1",
    quartier: "Akwa",
    location: null,
    client_availability_mode: "flexible",
    client_availability_note: null,
    sub_services: [],
    created_at: "2024-01-01T00:00:00",
    updated_at: null,
    history: [],
    ...overrides,
  } as unknown as Demande;
}

function makeEvent(overrides: Partial<DemandeEvent> = {}): DemandeEvent {
  return {
    id: 1,
    demande_id: 1,
    event_type: "cree",
    previous_status: null,
    new_status: null,
    actor_label: null,
    created_at: "2024-01-01T00:00:00",
    ...overrides,
  } as unknown as DemandeEvent;
}

// ── cleanGeo ─────────────────────────────────────────────────────────────────

describe("cleanGeo", () => {
  it("returns empty string for null/undefined", () => {
    expect(cleanGeo(null)).toBe("");
    expect(cleanGeo(undefined)).toBe("");
    expect(cleanGeo("")).toBe("");
  });

  it("trims whitespace", () => {
    expect(cleanGeo("  Douala  ")).toBe("Douala");
  });

  it("returns value as-is when no whitespace", () => {
    expect(cleanGeo("Akwa")).toBe("Akwa");
  });
});

// ── demandeGeoLabel ───────────────────────────────────────────────────────────

describe("demandeGeoLabel", () => {
  it("returns ville, arrondissement, quartier joined", () => {
    const d = makeDemande({ ville: "Douala", arrondissement: "Douala 1", quartier: "Akwa" });
    expect(demandeGeoLabel(d)).toBe("Douala, Douala 1, Akwa");
  });

  it("skips empty parts", () => {
    const d = makeDemande({ ville: "Douala", arrondissement: "", quartier: "" });
    expect(demandeGeoLabel(d)).toBe("Douala");
  });

  it("falls back to location when all geo parts empty", () => {
    const d = makeDemande({ ville: "", arrondissement: "", quartier: "", location: "Bastos, Yaounde" });
    expect(demandeGeoLabel(d)).toBe("Bastos, Yaounde");
  });

  it("falls back to default when no location either", () => {
    const d = makeDemande({ ville: "", arrondissement: "", quartier: "", location: null });
    expect(demandeGeoLabel(d)).toBe("Localisation indisponible");
  });
});

// ── clientAvailabilityLabel ───────────────────────────────────────────────────

describe("clientAvailabilityLabel", () => {
  it("returns flexible label when mode is flexible", () => {
    const d = makeDemande({ client_availability_mode: "flexible", client_availability_note: null });
    expect(clientAvailabilityLabel(d)).toContain("Disponibilité client");
  });

  it("includes note when mode is fixe and note provided", () => {
    const d = makeDemande({ client_availability_mode: "fixe", client_availability_note: "Matin uniquement" });
    expect(clientAvailabilityLabel(d)).toBe("Disponibilité client : Matin uniquement");
  });
});

// ── themeStorageKey ───────────────────────────────────────────────────────────

describe("themeStorageKey", () => {
  it("returns key with guest when no username", () => {
    expect(themeStorageKey()).toContain("guest");
    expect(themeStorageKey(undefined)).toContain("guest");
  });

  it("normalizes username to lowercase", () => {
    expect(themeStorageKey("Alice")).toContain("alice");
  });

  it("trims username", () => {
    expect(themeStorageKey("  bob  ")).toContain("bob");
  });
});

// ── readThemePreference ───────────────────────────────────────────────────────

describe("readThemePreference", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns violet by default", () => {
    expect(readThemePreference("testuser")).toBe("violet");
  });

  it("returns rose when stored value is rose", () => {
    localStorage.setItem(themeStorageKey("testuser"), "rose");
    expect(readThemePreference("testuser")).toBe("rose");
  });

  it("returns violet for any other stored value", () => {
    localStorage.setItem(themeStorageKey("testuser"), "dark");
    expect(readThemePreference("testuser")).toBe("violet");
  });
});

// ── decodeJwt ─────────────────────────────────────────────────────────────────

describe("decodeJwt", () => {
  it("returns null for empty string", () => {
    expect(decodeJwt("")).toBeNull();
  });

  it("returns null for malformed token", () => {
    expect(decodeJwt("not.a.token.with.too.many.parts")).toBeNull();
    expect(decodeJwt("only.two")).toBeNull();
  });

  it("decodes a valid token", () => {
    // Build a minimal JWT manually: header.payload.signature
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ sub: "123", exp: 9999999999 }));
    const token = `${header}.${payload}.fakesig`;
    const claims = decodeJwt(token);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe("123");
    expect(claims?.exp).toBe(9999999999);
  });

  it("returns null when payload is invalid JSON", () => {
    const header = btoa("{}");
    const badPayload = btoa("not-json");
    expect(decodeJwt(`${header}.${badPayload}.sig`)).toBeNull();
  });
});

// ── isTokenExpired ────────────────────────────────────────────────────────────

describe("isTokenExpired", () => {
  it("returns false when claims is null/undefined", () => {
    expect(isTokenExpired(null)).toBe(false);
    expect(isTokenExpired(undefined)).toBe(false);
  });

  it("returns false when no exp field", () => {
    expect(isTokenExpired({} as never)).toBe(false);
  });

  it("returns true when exp is in the past", () => {
    expect(isTokenExpired({ exp: 1000 } as never, 2000)).toBe(true);
  });

  it("returns false when exp is in the future", () => {
    expect(isTokenExpired({ exp: 9999999999 } as never, 1000)).toBe(false);
  });
});

// ── shouldActualiserToken ─────────────────────────────────────────────────────

describe("shouldActualiserToken", () => {
  it("returns false when claims is null", () => {
    expect(shouldActualiserToken(null)).toBe(false);
  });

  it("returns true when token expires soon (within skew window)", () => {
    // exp = now + 10 seconds, skew is typically 300 → should refresh
    const now = 1000000;
    expect(shouldActualiserToken({ exp: now + 10 } as never, now)).toBe(true);
  });

  it("returns false when token is far from expiry", () => {
    const now = 1000000;
    expect(shouldActualiserToken({ exp: now + 9999 } as never, now)).toBe(false);
  });
});

// ── authHeaders ───────────────────────────────────────────────────────────────

describe("authHeaders", () => {
  it("returns correct Authorization header", () => {
    const headers = authHeaders("mytoken") as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer mytoken");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

// ── roleHomePath ──────────────────────────────────────────────────────────────

describe("roleHomePath", () => {
  it("returns client path for client role", () => {
    expect(roleHomePath("client")).toBe("/espace/client");
  });

  it("returns prestataire path for prestataire role", () => {
    expect(roleHomePath("prestataire")).toBe("/espace/prestataire");
  });

  it("returns root for unknown/undefined role", () => {
    expect(roleHomePath(undefined)).toBe("/");
  });
});

// ── formatCameroonPhone ───────────────────────────────────────────────────────

describe("formatCameroonPhone", () => {
  it("formats a 9-digit phone number", () => {
    expect(formatCameroonPhone("699123456")).toBe("+237 699 123 456");
  });

  it("preserves +237 prefix when already present", () => {
    expect(formatCameroonPhone("+237699123456")).toBe("+237 699 123 456");
  });

  it("returns original value when invalid", () => {
    expect(formatCameroonPhone("123")).toBe("123");
  });
});

// ── normalizePersonName ───────────────────────────────────────────────────────

describe("normalizePersonName", () => {
  it("capitalizes first letter of each word", () => {
    expect(normalizePersonName("jean dupont")).toBe("Jean Dupont");
  });

  it("lowercases the rest", () => {
    expect(normalizePersonName("JEAN DUPONT")).toBe("Jean Dupont");
  });

  it("handles extra whitespace", () => {
    expect(normalizePersonName("  alice   bob  ")).toBe("Alice Bob");
  });

  it("returns empty string for empty input", () => {
    expect(normalizePersonName("")).toBe("");
    expect(normalizePersonName("   ")).toBe("");
  });
});

// ── userFacingError ───────────────────────────────────────────────────────────

describe("userFacingError", () => {
  it("returns fallback when error is not an Error instance", () => {
    expect(userFacingError("string error", "fallback", "ctx")).toBe("fallback");
    expect(userFacingError(null, "fallback", "ctx")).toBe("fallback");
  });

  it("returns fallback for null reading errors", () => {
    const err = new Error("Cannot read properties of null");
    expect(userFacingError(err, "fallback", "ctx")).toBe("fallback");
  });

  it("returns error message for normal errors", () => {
    const err = new Error("Erreur réseau");
    expect(userFacingError(err, "fallback", "ctx")).toBe("Erreur réseau");
  });

  it("returns fallback when message is empty", () => {
    const err = new Error("");
    expect(userFacingError(err, "fallback", "ctx")).toBe("fallback");
  });
});

// ── formatDateTime ────────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  it("returns indisponible for undefined", () => {
    expect(formatDateTime(undefined)).toBe("Date indisponible");
    expect(formatDateTime("")).toBe("Date indisponible");
  });

  it("returns indisponible for invalid date", () => {
    expect(formatDateTime("not-a-date")).toBe("Date indisponible");
  });

  it("formats a valid ISO date", () => {
    const result = formatDateTime("2024-03-15T14:30:00");
    // Should be a non-empty string in fr-FR format
    expect(result).not.toBe("Date indisponible");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── demandeStatusTone ─────────────────────────────────────────────────────────

describe("demandeStatusTone", () => {
  it("returns green for ouverte", () => expect(demandeStatusTone("ouverte")).toBe("green"));
  it("returns blue for attribuee", () => expect(demandeStatusTone("attribuee")).toBe("blue"));
  it("returns orange for annulee", () => expect(demandeStatusTone("annulee")).toBe("orange"));
  it("returns gray for unknown", () => expect(demandeStatusTone("terminee")).toBe("gray"));
});

// ── demandeStatusLabel ────────────────────────────────────────────────────────

describe("demandeStatusLabel", () => {
  it("returns label for known status", () => {
    const label = demandeStatusLabel("ouverte");
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });

  it("returns status itself for unknown", () => {
    expect(demandeStatusLabel("unknown_xyz")).toBe("unknown_xyz");
  });
});

// ── statusChipClass ───────────────────────────────────────────────────────────

describe("statusChipClass", () => {
  it("returns correct class for each known status", () => {
    expect(statusChipClass("ouverte")).toContain("chip-ouverte");
    expect(statusChipClass("attribuee")).toContain("chip-attribuee");
    expect(statusChipClass("annulee")).toContain("chip-annulee");
    expect(statusChipClass("expiree")).toContain("chip-expiree");
    expect(statusChipClass("en_cours")).toContain("chip-en-cours");
    expect(statusChipClass("terminee")).toContain("chip-terminee");
  });

  it("returns base class for unknown status", () => {
    expect(statusChipClass("unknown")).toBe("status-chip");
  });
});

// ── formatStatusLabel ─────────────────────────────────────────────────────────

describe("formatStatusLabel", () => {
  it("returns statut inconnu for null/undefined", () => {
    expect(formatStatusLabel(null)).toBe("statut inconnu");
    expect(formatStatusLabel(undefined)).toBe("statut inconnu");
  });

  it("returns label for known status", () => {
    const label = formatStatusLabel("ouverte");
    expect(typeof label).toBe("string");
    expect(label).not.toBe("statut inconnu");
  });

  it("replaces underscores for unknown status", () => {
    expect(formatStatusLabel("en_attente")).toContain(" ");
  });
});

// ── demandeEventText ──────────────────────────────────────────────────────────

describe("demandeEventText", () => {
  it("affiche un label explicite pour chaque type d'événement connu", () => {
    const knownTypes = [
      "cree", "modifiee", "attribuee", "acceptee", "confirmee", "en_cours", "terminee", "notee", "annulee", "expiree", "litige", "en_attente"
    ];
    for (const type of knownTypes) {
      const event = makeEvent({ event_type: type });
      const text = demandeEventText(event);
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
      // Pas de texte technique
      expect(text).not.toMatch(/Transition|Statut/);
    }
  });

  it("affiche 'Demande publiée' pour modifiee avec new_status ouverte", () => {
    const event = makeEvent({ event_type: "modifiee", previous_status: "ouverte", new_status: "ouverte" });
    const text = demandeEventText(event);
    expect(text).toContain("publi");
    expect(text).not.toMatch(/Transition|Statut/);
  });

  it("affiche 'Demande annulée' pour annulee", () => {
    const event = makeEvent({ event_type: "annulee", previous_status: "ouverte", new_status: "annulee" });
    const text = demandeEventText(event);
    expect(text).toContain("annul");
    expect(text).not.toMatch(/Transition|Statut/);
  });

  it("affiche 'Statut mis à jour' pour changement de statut explicite hors annulation", () => {
    const event = makeEvent({ event_type: "unknown_event", previous_status: "ouverte", new_status: "attribuee" });
    const text = demandeEventText(event);
    expect(text).toContain("Statut mis à jour");
    expect(text).toContain("Attribuée");
  });

  it("affiche 'Statut :' pour nouveau statut seul", () => {
    const event = makeEvent({ event_type: "unknown_event", previous_status: null, new_status: "en_cours" });
    const text = demandeEventText(event);
    expect(text).toContain("Statut :");
    expect(text).toContain("En cours");
  });

  it("affiche un fallback lisible pour type inconnu sans statut", () => {
    const event = makeEvent({ event_type: "inconnu", previous_status: null, new_status: null });
    const text = demandeEventText(event);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });
});

// ── demandeEventStepBadge ─────────────────────────────────────────────────────

describe("demandeEventStepBadge", () => {
  it("returns publiee badge for cree event", () => {
    const badge = demandeEventStepBadge(makeEvent({ event_type: "cree" }));
    expect(badge?.key).toBe("publiee");
  });

  it("returns publiee badge for ouverte new_status", () => {
    const badge = demandeEventStepBadge(makeEvent({ event_type: "other", new_status: "ouverte" }));
    expect(badge?.key).toBe("publiee");
  });

  it("returns attribuee badge for attribuee new_status", () => {
    const badge = demandeEventStepBadge(makeEvent({ event_type: "other", new_status: "attribuee" }));
    expect(badge?.key).toBe("attribuee");
  });

  it("returns en_cours badge", () => {
    const badge = demandeEventStepBadge(makeEvent({ event_type: "en_cours" }));
    expect(badge?.key).toBe("en_cours");
  });

  it("returns terminee badge", () => {
    const badge = demandeEventStepBadge(makeEvent({ event_type: "terminee" }));
    expect(badge?.key).toBe("terminee");
  });

  it("returns notee badge", () => {
    const badge = demandeEventStepBadge(makeEvent({ event_type: "notee" }));
    expect(badge?.key).toBe("notee");
  });

  it("returns null for unrecognized event", () => {
    const badge = demandeEventStepBadge(makeEvent({ event_type: "unknown_step", new_status: null }));
    expect(badge).toBeNull();
  });
});

// ── demandeEventActor ─────────────────────────────────────────────────────────

describe("demandeEventActor", () => {
  it("returns actor_label when present", () => {
    expect(demandeEventActor(makeEvent({ actor_label: "Alice (client)" }))).toBe("Alice (client)");
  });

  it("returns user ID label when no actor_label", () => {
    expect(demandeEventActor(makeEvent({ actor_label: null, actor_user_id: 42 } as never))).toBe("Utilisateur #42");
  });

  it("returns Système as fallback", () => {
    expect(demandeEventActor(makeEvent({ actor_label: null }))).toBe("Système");
  });
});

// ── priorityLabel / priorityClass ─────────────────────────────────────────────

describe("priorityLabel", () => {
  it("returns label for known priority", () => {
    const label = priorityLabel("haute");
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });

  it("returns Normale for unknown", () => {
    expect(priorityLabel("unknown")).toBe("Normale");
  });
});

describe("priorityClass", () => {
  it("returns CSS class for known priority", () => {
    const cls = priorityClass("haute");
    expect(cls).toContain("priority");
  });

  it("returns default class for unknown", () => {
    expect(priorityClass("other")).toContain("priority-normale");
  });
});

// ── demandeCategoryLabel ──────────────────────────────────────────────────────

describe("demandeCategoryLabel", () => {
  it("returns Ménage by default", () => {
    expect(demandeCategoryLabel(undefined)).toBe("Ménage");
    expect(demandeCategoryLabel("menage")).toBe("Ménage");
  });

  it("returns proper label for each category", () => {
    expect(demandeCategoryLabel("plomberie")).toBe("Plomberie");
    expect(demandeCategoryLabel("electricite")).toBe("Électricité");
    expect(demandeCategoryLabel("mecanique_auto")).toBe("Mécanique automobile");
    expect(demandeCategoryLabel("soudure")).toBe("Soudure");
    expect(demandeCategoryLabel("evenementiel")).toBe("Événementiel");
    expect(demandeCategoryLabel("reparation_electronique")).toBe("Réparation électronique");
    expect(demandeCategoryLabel("climatisation")).toBe("Climatisation & Réfrigération");
  });
});

// ── formatServicePrice ────────────────────────────────────────────────────────

describe("formatServicePrice", () => {
  it("returns À discuter for null/undefined", () => {
    expect(formatServicePrice(null)).toBe("À discuter");
    expect(formatServicePrice(undefined)).toBe("À discuter");
  });

  it("formats a price in FCFA", () => {
    const result = formatServicePrice(5000);
    expect(result).toContain("FCFA");
    expect(result).toContain("5");
  });
});

// ── groupEventsByDay ──────────────────────────────────────────────────────────

describe("groupEventsByDay", () => {
  it("returns empty array for no events", () => {
    expect(groupEventsByDay([])).toEqual([]);
  });

  it("groups events by day", () => {
    const e1 = makeEvent({ created_at: "2024-01-01T10:00:00" });
    const e2 = makeEvent({ created_at: "2024-01-01T15:00:00" });
    const e3 = makeEvent({ created_at: "2024-01-02T10:00:00" });
    const result = groupEventsByDay([e1, e2, e3] as never);
    expect(result).toHaveLength(2);
    expect(result[0].events).toHaveLength(2);
  });
});

// ── missionPipelineStatus ─────────────────────────────────────────────────────

describe("missionPipelineStatus", () => {
  it("returns pending for en_attente/acceptee/confirmee", () => {
    expect(missionPipelineStatus("en_attente")).toBe("pending");
    expect(missionPipelineStatus("acceptee")).toBe("pending");
    expect(missionPipelineStatus("confirmee")).toBe("pending");
  });

  it("returns active for en_cours", () => {
    expect(missionPipelineStatus("en_cours")).toBe("active");
  });

  it("returns done for terminee", () => {
    expect(missionPipelineStatus("terminee")).toBe("done");
  });

  it("returns other for unknown", () => {
    expect(missionPipelineStatus("annulee")).toBe("other");
  });
});

// ── demandeProgressIndex / demandeProgressSteps ───────────────────────────────

describe("demandeProgressIndex", () => {
  it("returns 0 for ouverte", () => expect(demandeProgressIndex("ouverte")).toBe(0));
  it("returns 1 for attribuee", () => expect(demandeProgressIndex("attribuee")).toBe(1));
  it("returns 2 for en_cours", () => expect(demandeProgressIndex("en_cours")).toBe(2));
  it("returns 3 for terminee", () => expect(demandeProgressIndex("terminee")).toBe(3));
  it("returns 0 for unknown", () => expect(demandeProgressIndex("unknown")).toBe(0));
});

describe("demandeProgressSteps", () => {
  it("returns 4 steps", () => {
    expect(demandeProgressSteps("ouverte")).toHaveLength(4);
  });

  it("marks correct step as active for attribuee", () => {
    const steps = demandeProgressSteps("attribuee");
    expect(steps[1].active).toBe(true);
    expect(steps[0].done).toBe(true);
  });
});

// ── formatResponseDelay ───────────────────────────────────────────────────────

describe("formatResponseDelay", () => {
  it("returns indisponible for null", () => {
    expect(formatResponseDelay(null)).toContain("indisponible");
    expect(formatResponseDelay(undefined)).toContain("indisponible");
  });

  it("returns minutes when < 60", () => {
    expect(formatResponseDelay(30)).toContain("30 min");
  });

  it("returns hours when >= 60 and no remainder", () => {
    expect(formatResponseDelay(120)).toContain("2 h");
    expect(formatResponseDelay(120)).not.toContain("min");
  });

  it("returns hours and minutes when remainder", () => {
    expect(formatResponseDelay(90)).toContain("1 h 30 min");
  });
});

// ── etaReliabilityLabel ───────────────────────────────────────────────────────

describe("etaReliabilityLabel", () => {
  it("returns fiable for >= 85", () => {
    expect(etaReliabilityLabel(90)).toContain("fiable");
    expect(etaReliabilityLabel(90)).toContain("90%");
  });

  it("returns assez fiable for >= 60", () => {
    expect(etaReliabilityLabel(70)).toContain("assez fiable");
  });

  it("returns à confirmer for < 60", () => {
    expect(etaReliabilityLabel(50)).toContain("à confirmer");
  });
});

// ── trustBadgeTone ────────────────────────────────────────────────────────────

describe("trustBadgeTone", () => {
  it("returns strong class for >= 85", () => {
    expect(trustBadgeTone(90)).toContain("strong");
  });

  it("returns medium class for >= 60", () => {
    expect(trustBadgeTone(70)).toContain("medium");
  });

  it("returns soft class for < 60", () => {
    expect(trustBadgeTone(50)).toContain("soft");
  });
});

// ── badgeLabel ────────────────────────────────────────────────────────────────

describe("badgeLabel", () => {
  it("returns known badge labels", () => {
    expect(badgeLabel("mission-5")).toContain("5");
    expect(badgeLabel("mission-10")).toContain("10");
    expect(badgeLabel("mission-20")).toContain("20");
  });

  it("returns slug for unknown badge", () => {
    expect(badgeLabel("unknown-badge")).toBe("unknown-badge");
  });
});

// ── scoreBarClass ─────────────────────────────────────────────────────────────

describe("scoreBarClass", () => {
  it("returns strong for >= 85", () => expect(scoreBarClass(90)).toContain("strong"));
  it("returns medium for >= 60", () => expect(scoreBarClass(65)).toContain("medium"));
  it("returns soft for < 60", () => expect(scoreBarClass(40)).toContain("soft"));
});

// ── initialsFromText ──────────────────────────────────────────────────────────

describe("initialsFromText", () => {
  it("returns CL for empty/null", () => {
    expect(initialsFromText(null)).toBe("CL");
    expect(initialsFromText("")).toBe("CL");
  });

  it("returns two initials from two words", () => {
    expect(initialsFromText("Alice Dupont")).toBe("AD");
  });

  it("returns first two chars from single word", () => {
    expect(initialsFromText("Alice")).toBe("AL");
  });
});

// ── dateRefPart ───────────────────────────────────────────────────────────────

describe("dateRefPart", () => {
  it("returns 8-digit string from valid date", () => {
    const result = dateRefPart("2024-03-05T00:00:00");
    expect(result).toBe("20240305");
  });

  it("returns current date for invalid input", () => {
    const result = dateRefPart("not-a-date");
    expect(result).toHaveLength(8);
    expect(/^\d{8}$/.test(result)).toBe(true);
  });

  it("returns current date for undefined", () => {
    const result = dateRefPart(undefined);
    expect(result).toHaveLength(8);
  });
});

// ── demandRef ─────────────────────────────────────────────────────────────────

describe("demandRef", () => {
  it("formats reference with zero-padded order", () => {
    expect(demandRef("DEM", "AD", "20240305", 1)).toBe("DEM-AD-20240305-001");
    expect(demandRef("SRV", "JD", "20241231", 42)).toBe("SRV-JD-20241231-042");
  });
});

// ── initialsFromActorLabel ────────────────────────────────────────────────────

describe("initialsFromActorLabel", () => {
  it("returns null for empty/null", () => {
    expect(initialsFromActorLabel(null)).toBeNull();
    expect(initialsFromActorLabel("")).toBeNull();
  });

  it("returns initials from actor label", () => {
    expect(initialsFromActorLabel("Alice Dupont (client)")).toBe("AD");
  });
});

// ── prestataireTrustProps ─────────────────────────────────────────────────────

describe("prestataireTrustProps", () => {
  it("returns all expected properties", () => {
    const summary = {
      display_name: "Jean Dupont",
      trust: {
        rating: 4.5,
        verified: true,
        completed_missions: 10,
        total_missions: 12,
        average_response_minutes: 30,
        eta_reliability_percent: 90,
      },
    } as unknown as PrestataireMissionSummary;
    const props = prestataireTrustProps(summary);
    expect(props.displayName).toBe("Jean Dupont");
    expect(props.rating).toBe("4.5");
    expect(props.verified).toBe(true);
    expect(props.completedMissions).toBe(10);
    expect(props.responseDelay).toContain("30 min");
    expect(props.etaClass).toContain("strong");
    expect(props.etaLabel).toContain("fiable");
  });
});

// ── apiFetch ──────────────────────────────────────────────────────────────────
import { apiFetch } from "./utils";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on ok response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve({ id: 1 }),
    });

    const result = await apiFetch<{ id: number }>("/test");
    expect(result).toEqual({ id: 1 });
  });

  it("throws on non-ok response with detail", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve({ detail: "Bad request" }),
    });

    await expect(apiFetch("/test")).rejects.toThrow("Bad request");
  });

  it("throws HTTP status on non-ok response without detail", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => "text/plain" },
      text: () => Promise.resolve(""),
    });

    await expect(apiFetch("/test")).rejects.toThrow("HTTP 500");
  });
});
