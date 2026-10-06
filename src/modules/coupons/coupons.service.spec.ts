import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { Coupon, CouponType } from './entities/coupon.entity';

const STORE_A = 'a0000000-0000-4000-8000-000000000001';
const STORE_B = 'b0000000-0000-4000-8000-000000000002';

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    remove: jest.fn(),
  };
}

describe('CouponsService — aislamiento por tienda', () => {
  let service: CouponsService;
  let couponsRepository: ReturnType<typeof createRepoMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CouponsService, { provide: getRepositoryToken(Coupon), useFactory: createRepoMock }],
    }).compile();

    service = module.get(CouponsService);
    couponsRepository = module.get(getRepositoryToken(Coupon));
  });

  describe('create()', () => {
    it('rechaza crear un cupón en la tienda de otro vendedor', async () => {
      await expect(
        service.create({ code: 'X', type: CouponType.PERCENTAGE, value: 10, storeId: STORE_B } as any, [STORE_A]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza crear un cupón global si es seller', async () => {
      await expect(
        service.create({ code: 'X', type: CouponType.PERCENTAGE, value: 10 } as any, [STORE_A]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite crear un cupón en la propia tienda', async () => {
      await expect(
        service.create({ code: 'X', type: CouponType.PERCENTAGE, value: 10, storeId: STORE_A } as any, [STORE_A]),
      ).resolves.toBeDefined();
    });

    it('un admin (allowedStoreIds undefined) puede crear un cupón global', async () => {
      await expect(
        service.create({ code: 'X', type: CouponType.PERCENTAGE, value: 10 } as any, undefined),
      ).resolves.toBeDefined();
    });
  });

  describe('findAll()', () => {
    it('restringe el listado a las tiendas del vendedor', async () => {
      await service.findAll([STORE_A]);
      const call = couponsRepository.find.mock.calls[0][0];
      expect(call.where.storeId._type).toBe('in');
      expect(call.where.storeId._value).toEqual([STORE_A]);
    });
  });

  describe('remove()', () => {
    it('rechaza eliminar un cupón de otra tienda', async () => {
      couponsRepository.findOne.mockResolvedValue({ id: 'c1', storeId: STORE_B });

      await expect(service.remove('c1', [STORE_A])).rejects.toThrow(NotFoundException);
    });

    it('rechaza eliminar un cupón global si es seller', async () => {
      couponsRepository.findOne.mockResolvedValue({ id: 'c1', storeId: null });

      await expect(service.remove('c1', [STORE_A])).rejects.toThrow(NotFoundException);
    });

    it('permite eliminar un cupón de la propia tienda', async () => {
      couponsRepository.findOne.mockResolvedValue({ id: 'c1', storeId: STORE_A });

      await expect(service.remove('c1', [STORE_A])).resolves.toEqual({ removed: true });
    });
  });

  describe('validate()', () => {
    function mockCoupon(storeId: string | null, overrides: Partial<Coupon> = {}) {
      couponsRepository.findOne.mockResolvedValue({
        id: 'c1',
        code: 'PROMO',
        storeId,
        isActive: true,
        expiresAt: null,
        maxUses: null,
        usedCount: 0,
        minOrderAmount: null,
        type: CouponType.PERCENTAGE,
        value: 10,
        ...overrides,
      });
    }

    it('rechaza un cupón de otra tienda', async () => {
      mockCoupon(STORE_B);

      await expect(service.validate('PROMO', 1000, STORE_A)).rejects.toThrow(BadRequestException);
    });

    it('rechaza un cupón de tienda en un carrito multi-tienda (storeId null)', async () => {
      mockCoupon(STORE_A);

      await expect(service.validate('PROMO', 1000, null)).rejects.toThrow(BadRequestException);
    });

    it('acepta un cupón de la misma tienda del carrito', async () => {
      mockCoupon(STORE_A);

      await expect(service.validate('PROMO', 1000, STORE_A)).resolves.toBeDefined();
    });

    it('un cupón global aplica sin importar la tienda del carrito', async () => {
      mockCoupon(null);

      await expect(service.validate('PROMO', 1000, STORE_A)).resolves.toBeDefined();
    });
  });
});
