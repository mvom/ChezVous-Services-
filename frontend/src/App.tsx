import type { JSX } from "react";
import AppOverlays from "./AppOverlays";
import AppShellRoutes from "./AppShellRoutes";
import AppStatusBar from "./AppStatusBar";
import AppHeaderBanner from "./AppHeaderBanner";
import { AppCtx } from "./AppContext";
import { HIDDEN_ADMIN_PATH, SUB_SERVICES_CONFIG } from "./constants";
import {
  demandeCategoryLabel,
  demandeEventActor,
  demandeEventStepBadge,
  demandeEventText,
  demandeStatusLabel,
  formatDateTime,
  formatStatusLabel,
  roleHomePath,
  statusChipClass,
} from "./utils";
import { useAppShellViewModel } from "./useAppShellViewModel";

function AppShell(): JSX.Element {
  const {
    contextValue,
    themeMode,
    role,
    isLoggedIn,
    loginPending,
    toast,
    handleThemeVioletClick,
    handleThemeRoseClick,
    handleClientAuthAccessClick,
    handlePrestataireAuthAccessClick,
    handleAdminLoginSubmit,
    selectedDemandForDetail,
    demandDetailClosing,
    closeDemandDetailModal,
    demandeLabel,
    demandeLabelById,
    editDemandeTarget,
    editDemandeDraft,
    setEditDemandeDraft,
    editDemandePending,
    editModalClosing,
    handleConfirmEditDemande,
    closeEditDemandeModal,
    demandeCancelId,
    cancelModalClosing,
    closeCancelDemandeModal,
    confirmCancelDemande,
    unregisterModalOpen,
    unregisterModalClosing,
    unregisterPassword,
    setUnregisterPassword,
    unregisterPending,
    closeUnregisterModal,
    confirmUnregister,
    cropModalOpen,
    cropModalClosing,
    cropImageSize,
    cropSourceDataUrl,
    cropZoom,
    cropOffsetX,
    cropOffsetY,
    onCropPointerDown,
    onCropPointerMove,
    onCropPointerUp,
    handleCropZoomChange,
    closeCropModal,
    confirmCropSelection,
    cropPending,
    avatarDisplaySize,
  } = useAppShellViewModel();

  return (
    <AppCtx.Provider value={contextValue}>
    <div className="app-shell" data-theme={themeMode}>
      <div className="bg-glow bg-glow-a" />
      <div className="bg-glow bg-glow-b" />
      <div className="bg-glow bg-glow-c" />

      <AppStatusBar
        role={role}
        themeMode={themeMode}
        onThemeViolet={handleThemeVioletClick}
        onThemeRose={handleThemeRoseClick}
      />

      <AppHeaderBanner />

      <main className="layout">
        <AppShellRoutes
          isLoggedIn={isLoggedIn}
          role={role}
          hiddenAdminPath={HIDDEN_ADMIN_PATH}
          loginPending={loginPending}
          roleHomePath={roleHomePath}
          handleClientAuthAccessClick={handleClientAuthAccessClick}
          handlePrestataireAuthAccessClick={handlePrestataireAuthAccessClick}
          handleAdminLoginSubmit={handleAdminLoginSubmit}
        />
      </main>

      <AppOverlays
        selectedDemandForDetail={selectedDemandForDetail}
        demandDetailClosing={demandDetailClosing}
        closeDemandDetailModal={closeDemandDetailModal}
        demandeLabel={demandeLabel}
        demandeCategoryLabel={demandeCategoryLabel}
        statusChipClass={statusChipClass}
        demandeStatusLabel={demandeStatusLabel}
        demandeEventStepBadge={demandeEventStepBadge}
        demandeEventText={demandeEventText}
        formatStatusLabel={formatStatusLabel}
        demandeEventActor={demandeEventActor}
        formatDateTime={formatDateTime}
        editDemandeTarget={editDemandeTarget}
        editDemandeDraft={editDemandeDraft}
        setEditDemandeDraft={setEditDemandeDraft}
        editDemandePending={editDemandePending}
        editModalClosing={editModalClosing}
        handleConfirmEditDemande={handleConfirmEditDemande}
        closeEditDemandeModal={closeEditDemandeModal}
        subServicesConfig={SUB_SERVICES_CONFIG}
        demandeCancelId={demandeCancelId}
        cancelModalClosing={cancelModalClosing}
        demandeLabelById={demandeLabelById}
        closeCancelDemandeModal={closeCancelDemandeModal}
        confirmCancelDemande={confirmCancelDemande}
        unregisterModalOpen={unregisterModalOpen}
        unregisterModalClosing={unregisterModalClosing}
        unregisterPassword={unregisterPassword}
        setUnregisterPassword={setUnregisterPassword}
        unregisterPending={unregisterPending}
        closeUnregisterModal={closeUnregisterModal}
        confirmUnregister={confirmUnregister}
        cropModalOpen={cropModalOpen}
        cropModalClosing={cropModalClosing}
        cropImageSize={cropImageSize}
        cropSourceDataUrl={cropSourceDataUrl}
        cropZoom={cropZoom}
        cropOffsetX={cropOffsetX}
        cropOffsetY={cropOffsetY}
        onCropPointerDown={onCropPointerDown}
        onCropPointerMove={onCropPointerMove}
        onCropPointerUp={onCropPointerUp}
        handleCropZoomChange={handleCropZoomChange}
        closeCropModal={closeCropModal}
        confirmCropSelection={confirmCropSelection}
        cropPending={cropPending}
        avatarDisplaySize={avatarDisplaySize}
      />

      {toast ? <div className={`toast ${toast.kind}`}>{toast.message}</div> : null}
    </div>
    </AppCtx.Provider>
  );
}

export default function App(): JSX.Element {
  return <AppShell />;
}