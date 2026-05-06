import smtplib
from email.message import EmailMessage

from fastapi import HTTPException, status

from app.core.config import settings


class MailService:
    def _build_message(self, *, to_email: str, subject: str, body: str) -> EmailMessage:
        message = EmailMessage()
        message["From"] = settings.mail_from
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body)
        return message

    def _send(self, message: EmailMessage) -> None:
        backend = settings.mail_backend.lower()
        if backend == "disabled":
            return

        if backend == "mailhog":
            host = settings.mailhog_host
            port = settings.mailhog_port
            username = ""
            password = ""
            use_tls = False
        else:
            host = settings.smtp_host
            port = settings.smtp_port
            username = settings.smtp_username
            password = settings.smtp_password
            use_tls = settings.smtp_use_tls

        try:
            with smtplib.SMTP(host=host, port=port, timeout=10) as client:
                if use_tls:
                    client.starttls()
                if username:
                    client.login(username, password)
                client.send_message(message)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Impossible d'envoyer l'email de confirmation pour le moment",
            ) from exc

    def send_registration_confirmation(self, *, to_email: str, first_name: str, role: str) -> None:
        subject = "Confirmation d'inscription - ChezVous Services+"
        body = (
            f"Bonjour {first_name},\n\n"
            f"Votre inscription en tant que {role} a ete confirmee sur ChezVous Services+.\n"
            "Vous pouvez maintenant vous connecter et utiliser la plateforme.\n\n"
            "Equipe ChezVous Services+"
        )
        self._send(self._build_message(to_email=to_email, subject=subject, body=body))

    def send_unregistration_confirmation(self, *, to_email: str, first_name: str, role: str) -> None:
        subject = "Confirmation de desinscription - ChezVous Services+"
        body = (
            f"Bonjour {first_name},\n\n"
            f"Votre compte {role} a ete desinscrit de ChezVous Services+.\n"
            "Si cette action n'est pas de votre fait, contactez le support.\n\n"
            "Equipe ChezVous Services+"
        )
        self._send(self._build_message(to_email=to_email, subject=subject, body=body))

    def send_zone_demande_notification(
        self, *, to_email: str, first_name: str, demande_id: int, location: str, category: str
    ) -> None:
        subject = "Nouvelle demande dans votre zone - ChezVous Services+"
        body = (
            f"Bonjour {first_name},\n\n"
            f"Une nouvelle demande ({category}) vient d'etre publiee dans votre zone preferee : {location}.\n"
            f"Demande #{demande_id} — consultez votre espace prestataire pour en savoir plus.\n\n"
            "Equipe ChezVous Services+"
        )
        self._send(self._build_message(to_email=to_email, subject=subject, body=body))


mail_service = MailService()
