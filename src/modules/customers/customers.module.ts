import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerLedgerEntry } from './entities/customer-ledger-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerLedgerEntry])],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
