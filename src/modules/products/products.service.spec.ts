import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductFavorite } from './entities/product-favorite.entity';
import { ProductVideo } from './entities/product-video.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Category } from '../categories/entities/category.entity';
import { Store } from '../stores/entities/store.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Customer } from '../customers/entities/customer.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { InventoryService } from '../inventory/inventory.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

// Dos tiendas de dueños distintos — todo el bug de multi-tenancy que estamos
// probando es que "Tienda B" (storeB) nunca debe ser accesible por quien
// opera sobre "Tienda A" (storeA).
const STORE_A = 'a0000000-0000-4000-8000-000000000001';
const STORE_B = 'b0000000-0000-4000-8000-000000000002';
const CATEGORY_A = 'c0000000-0000-4000-8000-00000000000a';
const CATEGORY_B = 'c0000000-0000-4000-8000-00000000000b';
const CATEGORY_GLOBAL = 'c0000000-0000-4000-8000-00000000000g';

function createRawQueryBuilderMock() {
  const qb: any = {
    select: () => qb,
    addSelect: () => qb,
    from: () => qb,
    where: () => qb,
    andWhere: () => qb,
    groupBy: () => qb,
    getRawMany: () => Promise.resolve([]),
  };
  return qb;
}

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    remove: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => createRawQueryBuilderMock()),
    manager: {
      transaction: jest.fn((cb: any) => cb({ getRepository: () => createRepoMock() })),
      createQueryBuilder: jest.fn(() => createRawQueryBuilderMock()),
    },
  };
}

describe('ProductsService — aislamiento por tienda', () => {
  let service: ProductsService;
  let categoriesRepository: ReturnType<typeof createRepoMock>;
  let storesRepository: ReturnType<typeof createRepoMock>;
  let productsRepository: ReturnType<typeof createRepoMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useFactory: createRepoMock },
        { provide: getRepositoryToken(ProductFavorite), useFactory: createRepoMock },
        { provide: getRepositoryToken(ProductVideo), useFactory: createRepoMock },
        { provide: getRepositoryToken(ProductImage), useFactory: createRepoMock },
        { provide: getRepositoryToken(ProductVariant), useFactory: createRepoMock },
        { provide: getRepositoryToken(Category), useFactory: createRepoMock },
        { provide: getRepositoryToken(Store), useFactory: createRepoMock },
        { provide: getRepositoryToken(Supplier), useFactory: createRepoMock },
        { provide: getRepositoryToken(Customer), useFactory: createRepoMock },
        { provide: getRepositoryToken(SaleItem), useFactory: createRepoMock },
        { provide: InventoryService, useValue: { createSystemBatchEntry: jest.fn(), getCurrentStock: jest.fn() } },
        { provide: CloudinaryService, useValue: { uploadImage: jest.fn(), deleteImage: jest.fn() } },
      ],
    }).compile();

    service = module.get(ProductsService);
    categoriesRepository = module.get(getRepositoryToken(Category));
    storesRepository = module.get(getRepositoryToken(Store));
    productsRepository = module.get(getRepositoryToken(Product));
  });

  function mockCategory(id: string, storeId: string | null) {
    categoriesRepository.findOne.mockImplementation(({ where }: any) =>
      where.id === id ? Promise.resolve({ id, storeId }) : Promise.resolve(null),
    );
  }

  function mockStore(id: string) {
    storesRepository.findOne.mockImplementation(({ where }: any) =>
      where.id === id ? Promise.resolve({ id }) : Promise.resolve(null),
    );
  }

  describe('create()', () => {
    it('rechaza crear un producto en la tienda de otro vendedor', async () => {
      mockCategory(CATEGORY_A, STORE_A);
      mockStore(STORE_A);

      await expect(
        service.create(
          { name: 'x', description: 'x', price: 1, categoryId: CATEGORY_A, storeId: STORE_B } as any,
          [STORE_A], // el vendedor solo es dueño de STORE_A
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite crear un producto en la propia tienda', async () => {
      mockCategory(CATEGORY_A, STORE_A);
      mockStore(STORE_A);

      await expect(
        service.create(
          { name: 'x', description: 'x', price: 1, categoryId: CATEGORY_A, storeId: STORE_A } as any,
          [STORE_A],
        ),
      ).resolves.toBeDefined();
    });

    it('rechaza asociar un producto a una categoría de otra tienda', async () => {
      mockCategory(CATEGORY_B, STORE_B); // la categoría pertenece a STORE_B
      mockStore(STORE_A);

      await expect(
        service.create(
          { name: 'x', description: 'x', price: 1, categoryId: CATEGORY_B, storeId: STORE_A } as any,
          [STORE_A],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite asociar un producto a una categoría global (storeId null)', async () => {
      mockCategory(CATEGORY_GLOBAL, null);
      mockStore(STORE_A);

      await expect(
        service.create(
          { name: 'x', description: 'x', price: 1, categoryId: CATEGORY_GLOBAL, storeId: STORE_A } as any,
          [STORE_A],
        ),
      ).resolves.toBeDefined();
    });

    it('un admin (allowedStoreIds undefined) puede crear en cualquier tienda', async () => {
      mockCategory(CATEGORY_B, STORE_B);
      mockStore(STORE_B);

      await expect(
        service.create(
          { name: 'x', description: 'x', price: 1, categoryId: CATEGORY_B, storeId: STORE_B } as any,
          undefined,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('update()', () => {
    function mockExistingProduct(storeId: string, categoryId = CATEGORY_A) {
      productsRepository.findOne.mockResolvedValue({
        id: 'p1',
        storeId,
        categoryId,
        name: 'n',
        description: 'd',
      });
    }

    it('rechaza reasignar un producto a la tienda de otro vendedor', async () => {
      mockExistingProduct(STORE_A);

      await expect(
        service.update('p1', { storeId: STORE_B } as any, 1, 'seller', [STORE_A]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza reasignar la categoría de un producto a la de otra tienda', async () => {
      mockExistingProduct(STORE_A);
      mockCategory(CATEGORY_B, STORE_B);

      await expect(
        service.update('p1', { categoryId: CATEGORY_B } as any, 1, 'seller', [STORE_A]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite editar campos normales del propio producto', async () => {
      mockExistingProduct(STORE_A);
      storesRepository.findOne.mockResolvedValue({ id: STORE_A, userId: 1 });

      await expect(
        service.update('p1', { name: 'nuevo nombre' } as any, 1, 'seller', [STORE_A]),
      ).resolves.toBeDefined();
    });
  });

  describe('findAll() — scoping para el panel de gestión', () => {
    function mockQueryBuilder() {
      const whereClauses: string[] = [];
      const qb: any = {
        leftJoinAndSelect: () => qb,
        andWhere: (clause: string) => {
          whereClauses.push(clause);
          return qb;
        },
        addSelect: () => qb,
        setParameter: () => qb,
        orderBy: () => qb,
        skip: () => qb,
        take: () => qb,
        getManyAndCount: () => Promise.resolve([[], 0]),
      };
      productsRepository.createQueryBuilder.mockReturnValue(qb);
      return whereClauses;
    }

    it('fuerza el filtro por las tiendas del vendedor aunque no se pida storeId', async () => {
      const whereClauses = mockQueryBuilder();
      await service.findAll({} as any, [STORE_A]);
      expect(whereClauses).toContain('product.storeId IN (:...scopedIds)');
    });

    it('rechaza pedir explícitamente una tienda ajena', async () => {
      mockQueryBuilder();
      await expect(service.findAll({ storeId: STORE_B } as any, [STORE_A])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('sin allowedStoreIds (catálogo público) no fuerza ningún scoping extra', async () => {
      const whereClauses = mockQueryBuilder();
      await service.findAll({} as any, undefined);
      expect(whereClauses).not.toContain('product.storeId IN (:...scopedIds)');
    });

    it('oculta cost y supplierId cuando se pide redactPrivateFields (catálogo público)', async () => {
      const qb: any = {
        leftJoinAndSelect: () => qb,
        andWhere: () => qb,
        addSelect: () => qb,
        setParameter: () => qb,
        orderBy: () => qb,
        skip: () => qb,
        take: () => qb,
        getManyAndCount: () =>
          Promise.resolve([[{ id: 'p1', cost: 500, supplierId: 'sup-1', supplier: { id: 'sup-1' } }], 1]),
      };
      productsRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({} as any, undefined, true);

      expect(result.items[0]).not.toHaveProperty('cost');
      expect(result.items[0]).not.toHaveProperty('supplierId');
      expect(result.items[0]).not.toHaveProperty('supplier');
    });

    it('conserva cost y supplierId para el panel de gestión (/products/mine)', async () => {
      const qb: any = {
        leftJoinAndSelect: () => qb,
        andWhere: () => qb,
        addSelect: () => qb,
        setParameter: () => qb,
        orderBy: () => qb,
        skip: () => qb,
        take: () => qb,
        getManyAndCount: () => Promise.resolve([[{ id: 'p1', storeId: STORE_A, cost: 500 }], 1]),
      };
      productsRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({} as any, [STORE_A], false);

      expect(result.items[0]).toHaveProperty('cost', 500);
    });
  });
});
