<?php

namespace App\Mail\Transport;

use Psr\Log\LoggerInterface;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\RawMessage;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface as HttpConnectionException;

final class BrevoDiagnosticTransport implements TransportInterface
{
    public function __construct(
        private readonly TransportInterface $transport,
        private readonly LoggerInterface $logger,
        private readonly string $apiKey,
    ) {}

    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
    {
        try {
            return $this->transport->send($message, $envelope);
        } catch (TransportExceptionInterface $exception) {
            // Laravel's notification sender discards HttpTransportException's
            // previous exception. Capture the connection cause before that happens.
            $context = ['exception' => get_class($exception)];
            $cause = $exception->getPrevious();
            if ($cause instanceof HttpConnectionException) {
                $detail = $cause->getMessage();
                if ($this->apiKey !== '') {
                    $detail = str_replace($this->apiKey, '[redacted]', $detail);
                }
                $context['connection_error'] = substr($detail, 0, 1000);
            }

            // Do not log the email, recipients, HTTP headers, or response body.
            $this->logger->error('Brevo email delivery failed', $context);

            throw $exception;
        }
    }

    public function __toString(): string
    {
        return (string) $this->transport;
    }
}
