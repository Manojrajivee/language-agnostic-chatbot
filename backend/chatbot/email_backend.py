import smtplib
import socket
from django.core.mail.backends.smtp import EmailBackend as DjangoSMTPBackend


class IPv4EmailBackend(DjangoSMTPBackend):
    """
    Custom SMTP backend that forces IPv4 connections.
    Fixes 'Errno 101 Network is unreachable' on hosts like Render
    where outbound IPv6 isn't properly routed.
    """
    def open(self):
        if self.connection:
            return False
        try:
            # Force IPv4 resolution
            original_getaddrinfo = socket.getaddrinfo

            def ipv4_getaddrinfo(*args, **kwargs):
                responses = original_getaddrinfo(*args, **kwargs)
                return [r for r in responses if r[0] == socket.AF_INET]

            socket.getaddrinfo = ipv4_getaddrinfo

            self.connection = self.connection_class(
                self.host, self.port, timeout=self.timeout
            )
            if self.use_tls:
                self.connection.starttls()
            if self.username and self.password:
                self.connection.login(self.username, self.password)
            return True
        except (smtplib.SMTPException, OSError):
            if not self.fail_silently:
                raise
        finally:
            # Restore original resolver so it doesn't affect the rest of the app
            socket.getaddrinfo = original_getaddrinfo