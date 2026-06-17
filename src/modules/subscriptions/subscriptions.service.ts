import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { StoreSubscription, SubscriptionStatus } from './entities/store-subscription.entity';
import { Store } from '../stores/entities/store.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CreatePlanDto } from './dto/create-plan.dto';

@Injectable()
export class SubscriptionsService implements OnModuleInit {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly plansRepository: Repository<SubscriptionPlan>,
    @InjectRepository(StoreSubscription)
    private readonly subsRepository: Repository<StoreSubscription>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPlans();
  }

  private async seedDefaultPlans() {
    const count = await this.plansRepository.count();
    if (count > 0) return;

    const defaults = [
      { name: 'Básico', description: 'Acceso estándar a la plataforma', priceMonthly: 50000, durationDays: 30 },
      { name: 'Estándar', description: 'Mayor visibilidad y soporte prioritario', priceMonthly: 90000, durationDays: 30 },
      { name: 'Premium', description: 'Publicidad destacada + todas las funciones', priceMonthly: 150000, durationDays: 30 },
    ];

    for (const plan of defaults) {
      await this.plansRepository.save(this.plansRepository.create(plan));
    }
  }

  // ── Plans ─────────────────────────────────────────────────────────────────
  async getPlans() {
    return this.plansRepository.find({ order: { priceMonthly: 'ASC' } });
  }

  async createPlan(dto: CreatePlanDto) {
    const plan = this.plansRepository.create({ ...dto, isActive: dto.isActive ?? true });
    return this.plansRepository.save(plan);
  }

  async updatePlan(id: string, dto: Partial<CreatePlanDto>) {
    const plan = await this.plansRepository.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    Object.assign(plan, dto);
    return this.plansRepository.save(plan);
  }

  // ── Subscriptions ────────────────────────────────────────────────────────
  async getStoreSubscriptions(storeId: string) {
    return this.subsRepository.find({
      where: { storeId },
      order: { createdAt: 'DESC' },
    });
  }

  async registerPayment(dto: CreateSubscriptionDto, userId?: number) {
    const store = await this.storesRepository.findOne({ where: { id: dto.storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const plan = await this.plansRepository.findOne({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const sub = this.subsRepository.create({
      storeId: dto.storeId,
      planId: dto.planId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      paidAmount: dto.paidAmount,
      paymentMethod: dto.paymentMethod,
      status: dto.status ?? SubscriptionStatus.ACTIVE,
      notes: dto.notes ?? null,
      receiptUrl: dto.receiptUrl ?? null,
      registeredByUserId: userId ?? null,
    });

    const saved = await this.subsRepository.save(sub);

    // Update store's subscriptionExpiresAt to the furthest active end date
    const latestSub = await this.subsRepository.findOne({
      where: { storeId: dto.storeId, status: SubscriptionStatus.ACTIVE },
      order: { endDate: 'DESC' },
    });
    if (latestSub) {
      await this.storesRepository.update(dto.storeId, {
        subscriptionExpiresAt: latestSub.endDate,
        isPremiumAdvertiser: plan.name.toLowerCase().includes('premium'),
      });
    }

    return saved;
  }

  async cancelSubscription(id: string) {
    const sub = await this.subsRepository.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    sub.status = SubscriptionStatus.CANCELLED;
    return this.subsRepository.save(sub);
  }

  // ── Admin Dashboard ───────────────────────────────────────────────────────
  async getAdminDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [allStores, allSubs] = await Promise.all([
      this.storesRepository.find({ order: { createdAt: 'DESC' } }),
      this.subsRepository.find({
        order: { createdAt: 'DESC' },
        relations: ['store', 'plan'],
      }),
    ]);

    // Determine current status per store (based on subscriptionExpiresAt)
    const storeStatusMap = new Map<string, 'ACTIVE' | 'EXPIRED' | 'NEVER'>();
    for (const store of allStores) {
      if (!store.subscriptionExpiresAt) {
        storeStatusMap.set(store.id, 'NEVER');
      } else if (new Date(store.subscriptionExpiresAt) >= now) {
        storeStatusMap.set(store.id, 'ACTIVE');
      } else {
        storeStatusMap.set(store.id, 'EXPIRED');
      }
    }

    const activeStores = allStores.filter((s) => storeStatusMap.get(s.id) === 'ACTIVE');
    const expiredStores = allStores.filter((s) => storeStatusMap.get(s.id) === 'EXPIRED');
    const neverPaidStores = allStores.filter((s) => storeStatusMap.get(s.id) === 'NEVER');

    const expiringIn14 = allStores.filter(
      (s) => s.subscriptionExpiresAt && new Date(s.subscriptionExpiresAt) >= now && new Date(s.subscriptionExpiresAt) <= in14Days,
    );
    const expiringIn30 = allStores.filter(
      (s) => s.subscriptionExpiresAt && new Date(s.subscriptionExpiresAt) >= now && new Date(s.subscriptionExpiresAt) <= in30Days,
    );

    // Revenue
    const activeSubs = allSubs.filter((s) => s.status === SubscriptionStatus.ACTIVE);
    const mrr = activeSubs.reduce((sum, s) => {
      const monthly = s.plan ? Number(s.plan.priceMonthly) : Number(s.paidAmount);
      return sum + monthly;
    }, 0);

    const totalCollected = allSubs
      .filter((s) => s.status !== SubscriptionStatus.CANCELLED)
      .reduce((sum, s) => sum + Number(s.paidAmount), 0);

    const thisMonthSubs = allSubs.filter(
      (s) => new Date(s.createdAt) >= startOfMonth && s.status !== SubscriptionStatus.CANCELLED,
    );
    const thisMonthCollected = thisMonthSubs.reduce((sum, s) => sum + Number(s.paidAmount), 0);

    const lastMonthSubs = allSubs.filter(
      (s) => new Date(s.createdAt) >= startOfLastMonth && new Date(s.createdAt) <= endOfLastMonth && s.status !== SubscriptionStatus.CANCELLED,
    );
    const lastMonthCollected = lastMonthSubs.reduce((sum, s) => sum + Number(s.paidAmount), 0);

    // Revenue by month (last 12)
    const revenueByMonth = this.buildMonthlyRevenue(allSubs, 12);

    // Latest subscription per store
    const latestSubByStore = new Map<string, StoreSubscription>();
    for (const sub of allSubs) {
      const existing = latestSubByStore.get(sub.storeId);
      if (!existing || new Date(sub.createdAt) > new Date(existing.createdAt)) {
        latestSubByStore.set(sub.storeId, sub);
      }
    }

    // Stores list with subscription status
    const storesWithStatus = allStores.map((store) => ({
      store,
      latestSubscription: latestSubByStore.get(store.id) ?? null,
      status: storeStatusMap.get(store.id) ?? 'NEVER',
    }));

    return {
      overview: {
        totalStores: allStores.length,
        activeSubscriptions: activeStores.length,
        expiredSubscriptions: expiredStores.length,
        neverPaid: neverPaidStores.length,
        expiringIn14Days: expiringIn14.length,
        expiringIn30Days: expiringIn30.length,
        premiumAdvertisers: allStores.filter((s) => s.isPremiumAdvertiser).length,
      },
      revenue: {
        mrr,
        arr: mrr * 12,
        totalCollected,
        thisMonthCollected,
        lastMonthCollected,
        newSubscriptionsThisMonth: thisMonthSubs.length,
        growthVsLastMonth:
          lastMonthCollected > 0
            ? Math.round(((thisMonthCollected - lastMonthCollected) / lastMonthCollected) * 100)
            : thisMonthCollected > 0 ? 100 : 0,
      },
      revenueByMonth,
      recentPayments: allSubs.slice(0, 15),
      storesWithStatus,
    };
  }

  private buildMonthlyRevenue(subs: StoreSubscription[], months: number) {
    const result: { month: string; label: string; amount: number; count: number }[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });

      const monthSubs = subs.filter(
        (s) =>
          s.status !== SubscriptionStatus.CANCELLED &&
          new Date(s.createdAt) >= start &&
          new Date(s.createdAt) <= end,
      );
      const amount = monthSubs.reduce((sum, s) => sum + Number(s.paidAmount), 0);
      result.push({ month: monthStr, label, amount, count: monthSubs.length });
    }
    return result;
  }

  async getStoreSubscriptionStatus(storeId: string) {
    const store = await this.storesRepository.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const subs = await this.subsRepository.find({
      where: { storeId },
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    let status: 'ACTIVE' | 'EXPIRED' | 'NEVER' = 'NEVER';
    if (store.subscriptionExpiresAt) {
      status = new Date(store.subscriptionExpiresAt) >= now ? 'ACTIVE' : 'EXPIRED';
    }

    return { store, subscriptions: subs, status };
  }
}
