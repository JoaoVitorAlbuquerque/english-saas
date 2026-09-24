import { buildDomainEvent } from './events';

describe('buildDomainEvent', () => {
  const payload = {
    jobId: '42',
    message: 'ping',
    processedAt: '2026-09-23T21:00:00.000Z',
  };

  it('usa o relógio recebido em vez do horário da máquina', () => {
    const occurredAt = new Date('2026-01-01T00:00:00.000Z');

    const event = buildDomainEvent('infra.example_job.processed', payload, {
      occurredAt,
    });

    expect(event.occurredAt).toBe(occurredAt);
    expect(event.name).toBe('infra.example_job.processed');
    expect(event.payload).toEqual(payload);
  });

  it('omite userId quando o fato não é de um aluno', () => {
    const event = buildDomainEvent('infra.example_job.processed', payload);

    expect('userId' in event).toBe(false);
  });

  it('carrega o userId quando informado', () => {
    const event = buildDomainEvent('infra.example_job.processed', payload, {
      userId: 'user-1',
    });

    expect(event.userId).toBe('user-1');
  });
});
