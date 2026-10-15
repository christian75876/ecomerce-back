import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';

const STORE_A = 'a0000000-0000-4000-8000-000000000001';
const STORE_B = 'b0000000-0000-4000-8000-000000000002';

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('CategoriesService — aislamiento por tienda', () => {
  let service: CategoriesService;
  let categoriesRepository: ReturnType<typeof createRepoMock>;
  let productsRepository: ReturnType<typeof createRepoMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useFactory: createRepoMock },
        { provide: getRepositoryToken(Product), useFactory: createRepoMock },
      ],
    }).compile();

    service = module.get(CategoriesService);
    categoriesRepository = module.get(getRepositoryToken(Category));
    productsRepository = module.get(getRepositoryToken(Product));
  });

  describe('update()', () => {
    it('rechaza editar la categoría de otra tienda', async () => {
      categoriesRepository.findOne.mockResolvedValue({ id: 'cat1', storeId: STORE_B, name: 'Old' });

      await expect(
        service.update('cat1', { name: 'Nuevo nombre' }, [STORE_A]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza editar una categoría global (storeId null) si no es admin', async () => {
      categoriesRepository.findOne.mockResolvedValue({ id: 'cat1', storeId: null, name: 'Global' });

      await expect(
        service.update('cat1', { name: 'Nuevo nombre' }, [STORE_A]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite editar la propia categoría', async () => {
      categoriesRepository.findOne.mockResolvedValue({ id: 'cat1', storeId: STORE_A, name: 'Old' });

      await expect(
        service.update('cat1', { name: 'Nuevo nombre' }, [STORE_A]),
      ).resolves.toMatchObject({ name: 'Nuevo nombre' });
    });

    it('un admin (allowedStoreIds undefined) puede editar cualquier categoría', async () => {
      categoriesRepository.findOne.mockResolvedValue({ id: 'cat1', storeId: STORE_B, name: 'Old' });

      await expect(
        service.update('cat1', { name: 'Nuevo nombre' }, undefined),
      ).resolves.toMatchObject({ name: 'Nuevo nombre' });
    });

    it('lanza NotFoundException si la categoría no existe, antes de validar tienda', async () => {
      categoriesRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('no-existe', { name: 'x' }, [STORE_A]),
      ).rejects.toThrow(NotFoundException);
    });

    it('la cascada de desactivar productos sigue funcionando sobre la propia categoría', async () => {
      categoriesRepository.findOne.mockResolvedValue({ id: 'cat1', storeId: STORE_A, isActive: true });

      await service.update('cat1', { isActive: false }, [STORE_A]);

      expect(productsRepository.update).toHaveBeenCalledWith(
        { categoryId: 'cat1' },
        { isActive: false },
      );
    });
  });

  describe('findAll() — scoping para el panel de gestión', () => {
    function mockQueryBuilder() {
      const whereClauses: string[] = [];
      const qb: any = {
        loadRelationCountAndMap: () => qb,
        andWhere: (clause: string) => {
          whereClauses.push(clause);
          return qb;
        },
        orderBy: () => qb,
        getMany: () => Promise.resolve([]),
      };
      categoriesRepository.createQueryBuilder.mockReturnValue(qb);
      return whereClauses;
    }

    it('incluye las propias tiendas y las categorías globales', async () => {
      const whereClauses = mockQueryBuilder();
      await service.findAll(undefined, undefined, [STORE_A]);
      expect(whereClauses).toContain(
        '(category.storeId IN (:...scopedIds) OR category.storeId IS NULL)',
      );
    });

    it('rechaza pedir explícitamente una tienda ajena', async () => {
      mockQueryBuilder();
      await expect(service.findAll(undefined, STORE_B, [STORE_A])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
