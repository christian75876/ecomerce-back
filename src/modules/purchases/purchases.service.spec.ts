import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { PurchasePayment } from './entities/purchase-payment.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { InventoryService } from '../inventory/inventory.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

const STORE_A = 'a0000000-0000-4000-8000-000000000001';
const STORE_B = 'b0000000-0000-4000-8000-000000000002';

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
  };
}

describe('PurchasesService — aislamiento por tienda', () => {
  let service: PurchasesService;
  let purchasesRepository: ReturnType<typeof createRepoMock>;
  let suppliersRepository: ReturnType<typeof createRepoMock>;
  let storesRepository: ReturnType<typeof createRepoMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        {
          provide: DataSource,
          useValue: { transaction: jest.fn((cb: any) => cb({ getRepository: () => createRepoMock() })) },
        },
        { provide: getRepositoryToken(Purchase), useFactory: createRepoMock },
        { provide: getRepositoryToken(PurchasePayment), useFactory: createRepoMock },
        { provide: getRepositoryToken(Supplier), useFactory: createRepoMock },
        { provide: getRepositoryToken(Store), useFactory: createRepoMock },
        { provide: getRepositoryToken(Product), useFactory: createRepoMock },
        { provide: getRepositoryToken(InventoryBatch), useFactory: createRepoMock },
        { provide: InventoryService, useValue: { createSystemBatchEntry: jest.fn(), createSystemMovement: jest.fn() } },
        { provide: CloudinaryService, useValue: { uploadImage: jest.fn() } },
      ],
    }).compile();

    service = module.get(PurchasesService);
    purchasesRepository = module.get(getRepositoryToken(Purchase));
    suppliersRepository = module.get(getRepositoryToken(Supplier));
    storesRepository = module.get(getRepositoryToken(Store));
  });

  describe('create()', () => {
    it('rechaza crear una compra en la tienda de otro vendedor', async () => {
      await expect(
        service.create(
          { supplierId: 's1', storeId: STORE_B, purchaseDate: new Date().toISOString(), items: [] } as any,
          [STORE_A],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite crear una compra en la propia tienda', async () => {
      suppliersRepository.findOne.mockResolvedValue({ id: 's1' });
      storesRepository.findOne.mockResolvedValue({ id: STORE_A, isActive: true });
      purchasesRepository.findOne.mockResolvedValue({
        id: 'pur1',
        storeId: STORE_A,
        supplier: {},
        store: {},
        items: [],
        payments: [],
      });

      await expect(
        service.create(
          { supplierId: 's1', storeId: STORE_A, purchaseDate: new Date().toISOString(), items: [] } as any,
          [STORE_A],
        ),
      ).resolves.toBeDefined();
    });

    it('un admin (allowedStoreIds undefined) puede crear en cualquier tienda', async () => {
      suppliersRepository.findOne.mockResolvedValue({ id: 's1' });
      storesRepository.findOne.mockResolvedValue({ id: STORE_B, isActive: true });
      purchasesRepository.findOne.mockResolvedValue({
        id: 'pur1',
        storeId: STORE_B,
        supplier: {},
        store: {},
        items: [],
        payments: [],
      });

      await expect(
        service.create(
          { supplierId: 's1', storeId: STORE_B, purchaseDate: new Date().toISOString(), items: [] } as any,
          undefined,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('update() / registerPayment() / cancel() — acceso directo por ID', () => {
    function mockPurchase(storeId: string) {
      purchasesRepository.findOne.mockResolvedValue({
        id: 'pur1',
        storeId,
        status: 'PENDING',
        total: 100,
        paidAmount: 0,
        balance: 100,
      });
    }

    it('update() rechaza modificar una compra de otra tienda', async () => {
      mockPurchase(STORE_B);

      await expect(
        service.update('pur1', { note: 'x' } as any, [STORE_A]),
      ).rejects.toThrow(NotFoundException);
    });

    it('registerPayment() rechaza pagar una compra de otra tienda', async () => {
      mockPurchase(STORE_B);

      await expect(
        service.registerPayment('pur1', { amount: 10, paymentMethod: 'CASH' } as any, undefined, [STORE_A]),
      ).rejects.toThrow(NotFoundException);
    });

    it('cancel() rechaza cancelar una compra de otra tienda', async () => {
      mockPurchase(STORE_B);

      await expect(
        service.cancel('pur1', { reason: 'x' } as any, [STORE_A]),
      ).rejects.toThrow(NotFoundException);
    });

    it('update() permite modificar una compra de la propia tienda', async () => {
      mockPurchase(STORE_A);

      await expect(
        service.update('pur1', { note: 'actualizado' } as any, [STORE_A]),
      ).resolves.toBeDefined();
    });
  });
});
