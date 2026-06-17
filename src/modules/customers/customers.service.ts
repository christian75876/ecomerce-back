import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import {
  CustomerLedgerEntry,
  CustomerLedgerEntryType,
} from './entities/customer-ledger-entry.entity';
import { RegisterCustomerPaymentDto } from './dto/register-customer-payment.dto';
import { Store } from '../stores/entities/store.entity';
import { QueryCustomersDto } from './dto/query-customers.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(CustomerLedgerEntry)
    private readonly ledgerRepository: Repository<CustomerLedgerEntry>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
  ) {}

  async findAll(query: QueryCustomersDto, allowedStoreIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.customersRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.store', 'store')
      .orderBy('customer.createdAt', 'DESC');

    if (allowedStoreIds?.length) {
      const ids = query.storeId
        ? allowedStoreIds.filter((id) => id === query.storeId)
        : allowedStoreIds;
      if (ids.length === 0) {
        builder.where('1 = 0');
      } else {
        builder.where('customer.storeId IN (:...storeIds)', { storeIds: ids });
      }
    } else if (query.storeId) {
      builder.where('customer.storeId = :storeId', { storeId: query.storeId });
    } else {
      builder.where('1 = 1');
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('customer.firstName ILIKE :search', { search })
            .orWhere('customer.lastName ILIKE :search', { search })
            .orWhere('customer.email ILIKE :search', { search })
            .orWhere(
              "CONCAT(customer.firstName, ' ', customer.lastName) ILIKE :search",
              { search },
            );
        }),
      );
    }

    const summaryRaw = await builder
      .clone()
      .orderBy()
      .select('COUNT(customer.id)', 'total_customers')
      .addSelect(
        'COUNT(CASE WHEN customer.credit_enabled = true THEN 1 END)',
        'credit_enabled_count',
      )
      .addSelect(
        'COUNT(CASE WHEN customer.credit_balance > 0 THEN 1 END)',
        'customers_with_debt_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN customer.credit_balance > 0 THEN customer.credit_balance ELSE 0 END), 0)',
        'total_portfolio',
      )
      .getRawOne<{
        total_customers: string;
        credit_enabled_count: string;
        customers_with_debt_count: string;
        total_portfolio: string;
      }>();

    const [customers, totalItems] = await builder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: customers,
      pagination: {
        totalItems,
        itemCount: customers.length,
        itemsPerPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
      },
      summary: {
        totalCustomers: Number(summaryRaw?.total_customers ?? 0),
        creditEnabledCount: Number(summaryRaw?.credit_enabled_count ?? 0),
        customersWithDebtCount: Number(summaryRaw?.customers_with_debt_count ?? 0),
        totalPortfolio: Number(summaryRaw?.total_portfolio ?? 0),
      },
    };
  }

  async findOne(id: string, storeId?: string) {
    const customer = await this.customersRepository.findOne({
      where: storeId ? { id, storeId } : { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async findByEmail(email: string, storeId?: string | null) {
    const normalizedEmail = email.trim().toLowerCase();
    return this.customersRepository.findOne({
      where: storeId
        ? { email: normalizedEmail, storeId }
        : { email: normalizedEmail },
    });
  }

  async create(createCustomerDto: CreateCustomerDto) {
    if (!createCustomerDto.storeId) {
      throw new BadRequestException('Store is required for customer');
    }

    await this.ensureStoreExists(createCustomerDto.storeId);

    const normalizedEmail = createCustomerDto.email.trim().toLowerCase();
    const existingCustomer = await this.findByEmail(
      normalizedEmail,
      createCustomerDto.storeId,
    );

    if (existingCustomer) {
      throw new ConflictException('Customer email is already in use for this store');
    }

    const customer = this.customersRepository.create({
      firstName: createCustomerDto.firstName.trim(),
      lastName: createCustomerDto.lastName.trim(),
      email: normalizedEmail,
      phone: createCustomerDto.phone?.trim() || null,
      creditEnabled: createCustomerDto.creditEnabled ?? false,
      creditLimit: createCustomerDto.creditLimit ?? null,
      creditBalance: 0,
      storeId: createCustomerDto.storeId,
    });

    return this.customersRepository.save(customer);
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto, storeId?: string) {
    const customer = await this.findOne(id, storeId);
    const targetStoreId = updateCustomerDto.storeId ?? customer.storeId;

    if (updateCustomerDto.storeId) {
      await this.ensureStoreExists(updateCustomerDto.storeId);
    }

    if (updateCustomerDto.email) {
      const normalizedEmail = updateCustomerDto.email.trim().toLowerCase();
      const existingCustomer = await this.findByEmail(
        normalizedEmail,
        targetStoreId,
      );

      if (existingCustomer && existingCustomer.id !== id) {
        throw new ConflictException('Customer email is already in use for this store');
      }

      customer.email = normalizedEmail;
    }

    if (typeof updateCustomerDto.firstName === 'string') {
      customer.firstName = updateCustomerDto.firstName.trim();
    }
    if (typeof updateCustomerDto.lastName === 'string') {
      customer.lastName = updateCustomerDto.lastName.trim();
    }
    if (typeof updateCustomerDto.phone === 'string') {
      customer.phone = updateCustomerDto.phone.trim() || null;
    }
    if (typeof updateCustomerDto.creditEnabled === 'boolean') {
      customer.creditEnabled = updateCustomerDto.creditEnabled;
    }
    if (typeof updateCustomerDto.creditLimit === 'number') {
      customer.creditLimit = updateCustomerDto.creditLimit;
    }
    if (typeof updateCustomerDto.storeId === 'string') {
      customer.storeId = updateCustomerDto.storeId;
    }

    return this.customersRepository.save(customer);
  }

  async getCreditStatus(id: string, storeId?: string) {
    const customer = await this.findOne(id, storeId);
    const ledger = await this.ledgerRepository.find({
      where: { customerId: id },
      order: { createdAt: 'DESC' },
    });

    return { customer, ledger };
  }

  async registerPayment(
    id: string,
    payload: RegisterCustomerPaymentDto,
    storeId?: string,
  ) {
    const customer = await this.findOne(id, storeId);

    if (payload.amount > Number(customer.creditBalance)) {
      throw new BadRequestException('Payment exceeds current customer balance');
    }

    customer.creditBalance = Number(customer.creditBalance) - payload.amount;
    await this.customersRepository.save(customer);

    const entry = this.ledgerRepository.create({
      customerId: customer.id,
      type: CustomerLedgerEntryType.PAYMENT,
      amount: -payload.amount,
      note: payload.note?.trim() || null,
    });
    await this.ledgerRepository.save(entry);

    return this.getCreditStatus(id, storeId);
  }

  async registerCreditSale(
    customerId: string,
    amount: number,
    referenceId?: string,
    storeId?: string | null,
  ) {
    const customer = await this.findOne(customerId, storeId ?? undefined);

    if (!customer.creditEnabled) {
      throw new BadRequestException('Customer credit is disabled');
    }

    const creditLimit = Number(customer.creditLimit ?? 0);
    const nextBalance = Number(customer.creditBalance) + amount;

    if (creditLimit > 0 && nextBalance > creditLimit) {
      throw new BadRequestException('Customer credit limit exceeded');
    }

    customer.creditBalance = nextBalance;
    await this.customersRepository.save(customer);

    const entry = this.ledgerRepository.create({
      customerId,
      type: CustomerLedgerEntryType.CREDIT_SALE,
      amount,
      note: 'Credit sale',
      referenceId: referenceId ?? null,
    });
    await this.ledgerRepository.save(entry);

    return customer;
  }

  private async ensureStoreExists(storeId: string) {
    const store = await this.storesRepository.findOne({ where: { id: storeId } });

    if (!store) {
      throw new NotFoundException('Store not found');
    }
  }
}
