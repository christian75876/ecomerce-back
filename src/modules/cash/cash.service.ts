import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashMovement, CashMovementType } from './entities/cash-movement.entity';
import { CashSession, CashSessionStatus } from './entities/cash-session.entity';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { Store } from '../stores/entities/store.entity';

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashSession)
    private readonly sessionsRepository: Repository<CashSession>,
    @InjectRepository(CashMovement)
    private readonly movementsRepository: Repository<CashMovement>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
  ) {}

  async findSessions(storeId?: string) {
    return this.sessionsRepository.find({
      where: storeId ? { storeId } : undefined,
      order: { createdAt: 'DESC' },
    });
  }

  async findSession(id: string) {
    const session = await this.sessionsRepository.findOne({ where: { id } });
    if (!session) {
      throw new NotFoundException('Cash session not found');
    }
    return session;
  }

  async openSession(userId: number, payload: OpenCashSessionDto) {
    const store = await this.storesRepository.findOne({
      where: { id: payload.storeId },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const existing = await this.sessionsRepository.findOne({
      where: {
        storeId: payload.storeId,
        userId,
        status: CashSessionStatus.OPEN,
      },
    });
    if (existing) {
      throw new BadRequestException('There is already an open cash session');
    }

    const session = this.sessionsRepository.create({
      storeId: payload.storeId,
      userId,
      openingAmount: payload.openingAmount,
      expectedAmount: payload.openingAmount,
      status: CashSessionStatus.OPEN,
    });

    return this.sessionsRepository.save(session);
  }

  async closeSession(id: string, payload: CloseCashSessionDto) {
    const session = await this.findSession(id);

    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('Cash session is not open');
    }

    session.closingAmount = payload.closingAmount;
    session.difference = payload.closingAmount - Number(session.expectedAmount);
    session.status = CashSessionStatus.CLOSED;
    session.closedAt = new Date();

    return this.sessionsRepository.save(session);
  }

  async addMovement(sessionId: string, payload: CreateCashMovementDto) {
    const session = await this.findSession(sessionId);

    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('Cash session is not open');
    }

    const signedAmount =
      payload.type === CashMovementType.MANUAL_OUT ? -payload.amount : payload.amount;
    session.expectedAmount = Number(session.expectedAmount) + signedAmount;
    await this.sessionsRepository.save(session);

    const movement = this.movementsRepository.create({
      cashSessionId: session.id,
      type: payload.type,
      amount: signedAmount,
      reason: payload.reason.trim(),
    });

    return this.movementsRepository.save(movement);
  }

  async registerCashSale(sessionId: string, amount: number) {
    const session = await this.findSession(sessionId);

    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('Cash session is not open');
    }

    session.expectedAmount = Number(session.expectedAmount) + amount;
    await this.sessionsRepository.save(session);
  }

  async getSessionMovements(sessionId: string) {
    await this.findSession(sessionId);
    return this.movementsRepository.find({
      where: { cashSessionId: sessionId },
      order: { createdAt: 'DESC' },
    });
  }
}
