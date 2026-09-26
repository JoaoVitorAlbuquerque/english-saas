import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { DomainEvent } from 'src/common/events';
import { UsersService } from 'src/modules/users/services/users.service';

import { NotificationsScheduler } from './notifications.scheduler';

/** Fuso que aparece pela primeira vez ganha o tick de hora em hora na hora. */
@Injectable()
export class NotificationsListener {
  constructor(
    private readonly scheduler: NotificationsScheduler,
    private readonly users: UsersService,
  ) {}

  @OnEvent('user.onboarded')
  async onUserOnboarded(event: DomainEvent<'user.onboarded'>): Promise<void> {
    if (event.userId === undefined) return;
    await this.scheduler.ensureTimezoneJob(
      await this.users.timezoneOf(event.userId),
    );
  }

  @OnEvent('profile.availability_changed')
  async onAvailabilityChanged(
    event: DomainEvent<'profile.availability_changed'>,
  ): Promise<void> {
    await this.scheduler.ensureTimezoneJob(event.payload.timezone);
  }
}
