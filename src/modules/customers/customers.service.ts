import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import {
  CustomerLedgerEntry,
  CustomerLedgerEntryType,
} from './entities/customer-ledger-entry.entity';
import { RegisterCustomerPaymentDto } from './dto/register-customer-payment.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(CustomerLedgerEntry)
    private readonly ledgerRepository: Repository<CustomerLedgerEntry>,
  ) {}

  async findAll(search?: string) {
    if (!search?.trim()) {
      return this.customersRepository.find({
        order: { createdAt: 'DESC' },
      });
    }

    return this.customersRepository.find({
      where: [
        { firstName: ILike(`%${search}%`) },
        { lastName: ILike(`%${search}%`) },
        { email: ILike(`%${search}%`) },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const customer = await this.customersRepository.findOne({ where: { id } });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async findByEmail(email: string) {
    return this.customersRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async create(createCustomerDto: CreateCustomerDto) {
    const normalizedEmail = createCustomerDto.email.trim().toLowerCase();
    const existingCustomer = await this.findByEmail(normalizedEmail);

    if (existingCustomer) {
      throw new ConflictException('Customer email is already in use');
    }

    const customer = this.customersRepository.create({
      firstName: createCustomerDto.firstName.trim(),
      lastName: createCustomerDto.lastName.trim(),
      email: normalizedEmail,
      phone: createCustomerDto.phone?.trim() || null,
      creditEnabled: createCustomerDto.creditEnabled ?? false,
      creditLimit: createCustomerDto.creditLimit ?? null,
      creditBalance: 0,
    });

    return this.customersRepository.save(customer);
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const customer = await this.findOne(id);

    if (updateCustomerDto.email) {
      const normalizedEmail = updateCustomerDto.email.trim().toLowerCase();
      const existingCustomer = await this.findByEmail(normalizedEmail);

      if (existingCustomer && existingCustomer.id !== id) {
        throw new ConflictException('Customer email is already in use');
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

    return this.customersRepository.save(customer);
  }

  async getCreditStatus(id: string) {
    const customer = await this.findOne(id);
    const ledger = await this.ledgerRepository.find({
      where: { customerId: id },
      order: { createdAt: 'DESC' },
    });

    return { customer, ledger };
  }

  async registerPayment(id: string, payload: RegisterCustomerPaymentDto) {
    const customer = await this.findOne(id);

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

    return this.getCreditStatus(id);
  }

  async registerCreditSale(customerId: string, amount: number, referenceId?: string) {
    const customer = await this.findOne(customerId);

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
}
