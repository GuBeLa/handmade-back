import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseConfig } from '../../config/firebase.config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [FirebaseConfig],
  exports: [FirebaseConfig],
})
export class FirebaseModule {}

