import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Server } from 'colyseus';
import { createServer } from 'http';
import { StickHeroRoom } from './StickHeroRoom';
import { GreenVillage } from './GreenVillage';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const gameServer = new Server({});

  gameServer.define('greenVillage', GreenVillage);
  gameServer.define('StickHeroRoom', StickHeroRoom);
  gameServer.attach({ server: app.getHttpServer() });

  await app.listen(3000);
}
bootstrap();
