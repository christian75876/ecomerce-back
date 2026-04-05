import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
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

    return this.customersRepository.save(customer);
  }
}
