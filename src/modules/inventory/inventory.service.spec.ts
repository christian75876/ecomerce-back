import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { InventoryBatchAllocation } from './entities/inventory-batch-allocation.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';

const STORE_A = 'a0000000-0000-4000-8000-000000000001';
const STORE_B = 'b0000000-0000-4000-8000-000000000002';

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
    manager: {},
  };
}

describe('InventoryService — aislamiento por tienda', () => {
  let service: InventoryService;
  let productsRepository: ReturnType<typeof createRepoMock>;
  let inventoryRepository: ReturnType<typeof createRepoMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(InventoryMovement), useFactory: createRepoMock },
        { provide: getRepositoryToken(Product), useFactory: createRepoMock },
        { provide: getRepositoryToken(InventoryBatch), useFactory: createRepoMock },
        { provide: getRepositoryToken(InventoryBatchAllocation), useFactory: createRepoMock },
        { provide: getRepositoryToken(Supplier), useFactory: createRepoMock },
      ],
    }).compile();

    service = module.get(InventoryService);
    productsRepository = module.get(getRepositoryToken(Product));
    inventoryRepository = module.get(getRepositoryToken(InventoryMovement));
  });

  describe('getMovements() — "Movimientos recientes"', () => {
    function mockQueryBuilder() {
      const whereClauses: string[] = [];
      const qb: any = {
        leftJoinAndSelect: () => qb,
        orderBy: () => qb,
        skip: () => qb,
        take: () => qb,
        andWhere: (clause: string) => {
          whereClauses.push(clause);
          return qb;
        },
        getManyAndCount: () => Promise.resolve([[], 0]),
      };
      inventoryRepository.createQueryBuilder.mockReturnValue(qb);
      return whereClauses;
    }

    it('fuerza el filtro por las tiendas del vendedor aunque no se pida storeId', async () => {
      const whereClauses = mockQueryBuilder();
      await service.getMovements(undefined, 1, 20, undefined, [STORE_A]);
      expect(whereClauses).toContain('product.storeId IN (:...allowedStoreIds)');
    });

    it('rechaza pedir explícitamente una tienda ajena', async () => {
      mockQueryBuilder();
      await expect(
        service.getMovements(undefined, 1, 20, STORE_B, [STORE_A]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sin allowedStoreIds (admin) no fuerza ningún scoping extra', async () => {
      const whereClauses = mockQueryBuilder();
      await service.getMovements(undefined, 1, 20, undefined, undefined);
      expect(whereClauses).not.toContain('product.storeId IN (:...allowedStoreIds)');
    });
  });

  describe('registerEntry() / registerMovement() — escritura', () => {
    it('rechaza registrar una entrada de inventario sobre un producto de otra tienda', async () => {
      productsRepository.findOne.mockResolvedValue({ id: 'p1', storeId: STORE_B });

      await expect(
        service.registerEntry(
          { productId: 'p1', quantity: 10, unitCost: 5 } as any,
          [STORE_A],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza registrar un movimiento sobre un producto de otra tienda', async () => {
      productsRepository.findOne.mockResolvedValue({ id: 'p1', storeId: STORE_B });

      await expect(
        service.registerMovement(
          { productId: 'p1', movementType: 'ADJUSTMENT', quantity: 5 } as any,
          [STORE_A],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un admin (allowedStoreIds undefined) puede registrar sobre cualquier producto', async () => {
      productsRepository.findOne.mockResolvedValue({
        id: 'p1',
        storeId: STORE_B,
        isPerishable: false,
      });
      inventoryRepository.findAndCount.mockResolvedValue([[], 0]);

      await expect(
        service.registerEntry(
          { productId: 'p1', quantity: 10, unitCost: 5 } as any,
          undefined,
        ),
      ).resolves.toBeDefined();
    });
  });
});
