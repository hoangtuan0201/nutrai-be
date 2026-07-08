import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Custom Validation Pipe
  app.useGlobalPipes(new CustomValidationPipe());

  // Swagger OpenAPI Setup
  const config = new DocumentBuilder()
    .setTitle('NutraAI API')
    .setDescription('NutraAI (AI-Powered Fitness & Nutrition Tracking) Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
