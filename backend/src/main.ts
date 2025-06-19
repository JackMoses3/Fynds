import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());

  // Debug middleware to log all requests
  app.use(
    (
      req: { method: any; originalUrl: any; headers: any; body: {} },
      res: any,
      next: () => void,
    ) => {
      console.log(
        `🌐 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`,
      );
      console.log(`📋 Headers:`, JSON.stringify(req.headers, null, 2));
      if (req.body && Object.keys(req.body).length > 0) {
        console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
      }
      next();
    },
  );

  await app.listen(process.env.PORT ?? 3000);
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
