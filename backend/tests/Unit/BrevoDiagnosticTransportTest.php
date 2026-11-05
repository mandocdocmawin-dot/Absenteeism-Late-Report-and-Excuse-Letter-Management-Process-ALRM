<?php

namespace Tests\Unit;

use App\Mail\Transport\BrevoDiagnosticTransport;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpClient\Exception\TransportException as ConnectionException;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\HttpTransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Email;
use Symfony\Contracts\HttpClient\ResponseInterface;

class BrevoDiagnosticTransportTest extends TestCase
{
    public function test_connection_details_are_logged_without_api_key_and_original_failure_is_preserved(): void
    {
        $failure = new HttpTransportException(
            'Could not reach the remote Brevo server.',
            $this->createMock(ResponseInterface::class),
            0,
            new ConnectionException('Idle timeout for api.brevo.com secret-test-key'),
        );
        $transport = $this->createMock(TransportInterface::class);
        $transport->expects($this->once())->method('send')->willThrowException($failure);
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->once())->method('error')->with('Brevo email delivery failed', [
            'exception' => HttpTransportException::class,
            'connection_error' => 'Idle timeout for api.brevo.com [redacted]',
        ]);
        $diagnostic = new BrevoDiagnosticTransport($transport, $logger, 'secret-test-key');

        try {
            $diagnostic->send(new Email);
            $this->fail('Expected the original delivery failure.');
        } catch (HttpTransportException $caught) {
            $this->assertSame($failure, $caught);
        }
    }

    public function test_successful_delivery_is_forwarded_without_logging(): void
    {
        $email = (new Email)->from('sender@example.com')->to('user@example.com')->text('Test');
        $sent = new SentMessage($email, Envelope::create($email));
        $transport = $this->createMock(TransportInterface::class);
        $transport->expects($this->once())->method('send')->with($email, null)->willReturn($sent);
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->never())->method('error');

        $this->assertSame($sent, (new BrevoDiagnosticTransport($transport, $logger, ''))->send($email));
    }
}
