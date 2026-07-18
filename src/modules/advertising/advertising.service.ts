import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreAdvertisement } from './entities/store-advertisement.entity';
import { Store } from '../stores/entities/store.entity';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';

@Injectable()
export class AdvertisingService {
  constructor(
    @InjectRepository(StoreAdvertisement)
    private readonly adsRepository: Repository<StoreAdvertisement>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
  ) {}

  // ── Admin Dashboard ──────────────────────────────────────────────────────────
  async getAdminDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [allStores, allAds] = await Promise.all([
      this.storesRepository.find({ order: { createdAt: 'DESC' } }),
      this.adsRepository.find({ order: { createdAt: 'DESC' }, relations: ['store'] }),
    ]);

    // Build a set of store IDs that have ever had an advertisement
    const storeIdsWithAds = new Set(allAds.map((ad) => ad.storeId));

    // Build latest ad per store
    const latestAdByStore = new Map<string, StoreAdvertisement>();
    for (const ad of allAds) {
      const existing = latestAdByStore.get(ad.storeId);
      if (!existing || new Date(ad.createdAt) > new Date(existing.createdAt)) {
        latestAdByStore.set(ad.storeId, ad);
      }
    }

    // Determine status per store
    const storeStatusMap = new Map<string, 'ACTIVE' | 'EXPIRED' | 'NEVER'>();
    for (const store of allStores) {
      if (!storeIdsWithAds.has(store.id)) {
        storeStatusMap.set(store.id, 'NEVER');
      } else if (store.isPremiumAdvertiser) {
        storeStatusMap.set(store.id, 'ACTIVE');
      } else {
        storeStatusMap.set(store.id, 'EXPIRED');
      }
    }

    const activeAds = allStores.filter((s) => storeStatusMap.get(s.id) === 'ACTIVE').length;
    const expiredAds = allStores.filter((s) => storeStatusMap.get(s.id) === 'EXPIRED').length;
    const neverPaid = allStores.filter((s) => storeStatusMap.get(s.id) === 'NEVER').length;

    const expiringIn14Days = allStores.filter(
      (s) =>
        s.advertisingExpiresAt &&
        s.isPremiumAdvertiser &&
        new Date(s.advertisingExpiresAt) >= now &&
        new Date(s.advertisingExpiresAt) <= in14Days,
    ).length;

    const expiringIn30Days = allStores.filter(
      (s) =>
        s.advertisingExpiresAt &&
        s.isPremiumAdvertiser &&
        new Date(s.advertisingExpiresAt) >= now &&
        new Date(s.advertisingExpiresAt) <= in30Days,
    ).length;

    // Revenue
    const nonCancelledAds = allAds.filter((a) => a.status !== 'CANCELLED');
    const totalCollected = nonCancelledAds.reduce((sum, a) => sum + Number(a.paidAmount), 0);

    const thisMonthAds = nonCancelledAds.filter((a) => new Date(a.createdAt) >= startOfMonth);
    const thisMonthCollected = thisMonthAds.reduce((sum, a) => sum + Number(a.paidAmount), 0);

    const lastMonthAds = nonCancelledAds.filter(
      (a) => new Date(a.createdAt) >= startOfLastMonth && new Date(a.createdAt) <= endOfLastMonth,
    );
    const lastMonthCollected = lastMonthAds.reduce((sum, a) => sum + Number(a.paidAmount), 0);

    const storesWithStatus = allStores.map((store) => ({
      store,
      latestAdvertisement: latestAdByStore.get(store.id) ?? null,
      status: storeStatusMap.get(store.id) ?? 'NEVER',
    }));

    return {
      overview: {
        totalStores: allStores.length,
        activeAds,
        expiredAds,
        neverPaid,
        expiringIn14Days,
        expiringIn30Days,
      },
      revenue: {
        totalCollected,
        thisMonthCollected,
        lastMonthCollected,
      },
      storesWithStatus,
    };
  }

  // ── Register Advertisement ────────────────────────────────────────────────────
  async registerAdvertisement(dto: CreateAdvertisementDto, adminUserId?: number) {
    const store = await this.storesRepository.findOne({ where: { id: dto.storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const ad = this.adsRepository.create({
      storeId: dto.storeId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      paidAmount: dto.paidAmount,
      paymentMethod: dto.paymentMethod,
      status: 'ACTIVE',
      notes: dto.notes ?? null,
      registeredByUserId: adminUserId ?? null,
    });

    const saved = await this.adsRepository.save(ad);

    // Update store advertising status
    await this.storesRepository.update(dto.storeId, {
      isPremiumAdvertiser: true,
      advertisingExpiresAt: new Date(dto.endDate),
    });

    return saved;
  }

  // ── Get Store Advertisements ──────────────────────────────────────────────────
  async getStoreAdvertisements(storeId: string) {
    return this.adsRepository.find({
      where: { storeId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Cancel Advertisement ──────────────────────────────────────────────────────
  async cancelAdvertisement(id: string) {
    const ad = await this.adsRepository.findOne({ where: { id } });
    if (!ad) throw new NotFoundException('Advertisement not found');

    ad.status = 'CANCELLED';
    const saved = await this.adsRepository.save(ad);

    // Reset store advertising flags
    await this.storesRepository.update(ad.storeId, {
      isPremiumAdvertiser: false,
      advertisingExpiresAt: null,
    });

    return saved;
  }
}
