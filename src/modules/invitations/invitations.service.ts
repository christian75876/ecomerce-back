import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { InvitationStatus, StoreInvitation } from './entities/store-invitation.entity';
import { EmailService } from '../auth/email.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);
  private readonly TTL_HOURS = 48;

  constructor(
    @InjectRepository(StoreInvitation)
    private readonly invitationsRepository: Repository<StoreInvitation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private expiresAt(): Date {
    return new Date(Date.now() + this.TTL_HOURS * 60 * 60 * 1000);
  }

  private async assertNotAlreadyRegistered(email: string): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: { email, isEmailVerified: true },
      select: ['id'],
    });
    if (existing) {
      throw new BadRequestException(
        'Este correo ya corresponde a un usuario registrado y verificado en la plataforma',
      );
    }
  }

  async create(email: string, adminUserId: number) {
    const normalized = email.trim().toLowerCase();

    await this.assertNotAlreadyRegistered(normalized);

    // Expire any pending invitation for this email
    await this.invitationsRepository.update(
      { email: normalized, status: InvitationStatus.PENDING },
      { status: InvitationStatus.EXPIRED },
    );

    const token = randomBytes(32).toString('hex');
    const invitation = this.invitationsRepository.create({
      email: normalized,
      tokenHash: this.hash(token),
      status: InvitationStatus.PENDING,
      invitedBy: adminUserId,
      expiresAt: this.expiresAt(),
      acceptedAt: null,
    });
    await this.invitationsRepository.save(invitation);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteUrl = `${frontendUrl}/register?token=${encodeURIComponent(token)}`;

    let emailSent = true;
    try {
      await this.emailService.sendInvitationEmail(normalized, token);
    } catch (err) {
      emailSent = false;
      this.logger.error(
        `[Invitation] Failed to send email to ${normalized}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }

    return {
      message: emailSent
        ? `Invitación enviada a ${normalized}`
        : `Invitación creada pero no se pudo enviar el correo`,
      email: normalized,
      emailSent,
      inviteUrl,
    };
  }

  async findAll() {
    const invitations = await this.invitationsRepository.find({
      order: { createdAt: 'DESC' },
    });

    // Auto-sync: mark PENDING invitations as ACCEPTED when the invited
    // email already has a registered+verified user (e.g. registered directly)
    const pending = invitations.filter((inv) => inv.status === InvitationStatus.PENDING);
    if (pending.length > 0) {
      const pendingEmails = pending.map((inv) => inv.email);
      const verifiedUsers = await this.userRepository.find({
        where: { email: In(pendingEmails), isEmailVerified: true },
        select: ['email'],
      });
      const verifiedEmailSet = new Set(verifiedUsers.map((u) => u.email));

      const toSync = pending.filter((inv) => verifiedEmailSet.has(inv.email));
      if (toSync.length > 0) {
        const now = new Date();
        await this.invitationsRepository.update(
          { id: In(toSync.map((inv) => inv.id)) },
          { status: InvitationStatus.ACCEPTED, acceptedAt: now },
        );
        toSync.forEach((inv) => {
          inv.status = InvitationStatus.ACCEPTED;
          inv.acceptedAt = now;
        });
      }
    }

    return invitations;
  }

  async validateToken(token: string) {
    const tokenHash = this.hash(token);
    const invitation = await this.invitationsRepository.findOne({
      where: { tokenHash, status: InvitationStatus.PENDING },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no válida o ya utilizada');
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationsRepository.save(invitation);
      throw new BadRequestException('La invitación ha expirado');
    }

    return { valid: true, email: invitation.email };
  }

  async resend(id: string, adminUserId: number) {
    const invitation = await this.invitationsRepository.findOne({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitación no encontrada');
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('La invitación ya fue aceptada');
    }
    return this.create(invitation.email, adminUserId);
  }

  async delete(id: string): Promise<{ message: string }> {
    const invitation = await this.invitationsRepository.findOne({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitación no encontrada');
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('No se puede eliminar una invitación ya aceptada');
    }
    await this.invitationsRepository.remove(invitation);
    return { message: 'Invitación eliminada' };
  }

  async markAccepted(token: string): Promise<void> {
    const tokenHash = this.hash(token);
    await this.invitationsRepository.update(
      { tokenHash, status: InvitationStatus.PENDING },
      { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
    );
  }
}
