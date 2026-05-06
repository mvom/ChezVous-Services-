import type { JSX } from "react";

export default function AppHeaderBanner(): JSX.Element {
  return (
    <>
      <header className="app-header">
        <span className="eyebrow">Services à Domicile</span>
        <h1>ChezVous Services+</h1>
        <p>Trouvez des prestataires de confiance près de chez vous, et gérez vos missions en toute sérénité.</p>
      </header>

      <section className="services-strip">
        <div className="services-strip__header">
          <p className="services-strip__label">Nos services disponibles</p>
          <p className="services-strip__sub">8 catégories de prestations à domicile</p>
        </div>
        <ul className="services-strip__list">
          <li className="service-chip service-chip--menage">
            <span className="service-chip__icon">🧹</span>
            <span className="service-chip__title">Ménage</span>
            <span className="service-chip__desc">Nettoyage, entretien, repassage</span>
          </li>
          <li className="service-chip service-chip--plomberie">
            <span className="service-chip__icon">🔧</span>
            <span className="service-chip__title">Plomberie</span>
            <span className="service-chip__desc">Fuites, installations, canalisations</span>
          </li>
          <li className="service-chip service-chip--electricite">
            <span className="service-chip__icon">⚡</span>
            <span className="service-chip__title">Électricité</span>
            <span className="service-chip__desc">Câblage, pannes, installations</span>
          </li>
          <li className="service-chip service-chip--mecanique">
            <span className="service-chip__icon">🔩</span>
            <span className="service-chip__title">Mécanique auto</span>
            <span className="service-chip__desc">Entretien, réparation, diagnostic</span>
          </li>
          <li className="service-chip service-chip--soudure">
            <span className="service-chip__icon">🔥</span>
            <span className="service-chip__title">Soudure</span>
            <span className="service-chip__desc">Métal, grilles, structures</span>
          </li>
          <li className="service-chip service-chip--evenementiel">
            <span className="service-chip__icon">🎉</span>
            <span className="service-chip__title">Événementiel</span>
            <span className="service-chip__desc">Décoration, organisation, traiteur</span>
          </li>
          <li className="service-chip service-chip--electronique">
            <span className="service-chip__icon">🛠️</span>
            <span className="service-chip__title">Réparation électronique</span>
            <span className="service-chip__desc">Téléphone, TV, ordinateur</span>
          </li>
          <li className="service-chip service-chip--climatisation">
            <span className="service-chip__icon">❄️</span>
            <span className="service-chip__title">Climatisation & Réfrigération</span>
            <span className="service-chip__desc">Climatiseur, frigo, congélateur</span>
          </li>
        </ul>
      </section>
    </>
  );
}
