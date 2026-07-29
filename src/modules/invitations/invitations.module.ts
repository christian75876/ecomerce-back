import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreInvitation } from './entities/store-invitation.entity';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StoreInvitation, User])],
  controllers: [InvitationsController],
  providers: [InvitationsService, RolesGuard],
  exports: [InvitationsService],
})
export class InvitationsModule {}
