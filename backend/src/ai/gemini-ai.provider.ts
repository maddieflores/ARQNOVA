import { BadGatewayException, GatewayTimeoutException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiImageInput, AiProvider } from './ai-provider';
import { buildGeminiNewDiagramPrompt, buildGeminiPrompt, UML_NEW_DIAGRAM_SYSTEM_INSTRUCTIONS, UML_SYSTEM_INSTRUCTIONS } from './ai-prompt';

@Injectable()
export class GeminiAiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiAiProvider.name);

  constructor(private readonly config: ConfigService) {}

  async generateUmlProposal(prompt: string, currentDiagram?: unknown, image?: AiImageInput): Promise<unknown> {
    const userContent = buildGeminiPrompt(prompt, currentDiagram, Boolean(image));
    return this.callGeminiApi(UML_SYSTEM_INSTRUCTIONS, userContent, image);
  }

  async generateNewUml(prompt?: string, image?: AiImageInput): Promise<unknown> {
    const userContent = buildGeminiNewDiagramPrompt(prompt, Boolean(image));
    return this.callGeminiApi(UML_NEW_DIAGRAM_SYSTEM_INSTRUCTIONS, userContent, image);
  }

  private async callGeminiApi(systemInstructions: string, userContent: string, image?: AiImageInput): Promise<unknown> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('GEMINI_API_KEY no está configurada en el backend.');
    }

    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-3.5-flash-lite').trim();
    const baseUrl = this.config.get<string>('GEMINI_API_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta').trim();
    const timeoutMs = this.config.get<number>('AI_TIMEOUT_MS', 25_000);

    const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;

    const userParts: any[] = [];
    if (image?.data) {
      const cleanBase64 = image.data.replace(/^data:[^;]+;base64,/, '').trim();
      userParts.push({
        inlineData: {
          mimeType: image.mimeType || 'image/png',
          data: cleanBase64,
        },
      });
    }
    userParts.push({ text: userContent });

    const payload = {
      system_instruction: {
        parts: [{ text: systemInstructions }],
      },
      contents: [
        {
          role: 'user',
          parts: userParts,
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new GatewayTimeoutException('El proveedor de IA excedió el tiempo permitido');
      }
      this.logger.error(`Error de conexión con Gemini API (modelo '${model}'): ${error?.message || error}`);
      throw new ServiceUnavailableException('No fue posible conectarse con el servicio de Gemini.');
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(
        `Gemini API Error [${response.status}] al invocar modelo '${model}' en '${baseUrl}/models/${model}:generateContent': ${errorText}`,
      );

      if (response.status === 404) {
        throw new BadGatewayException(
          `El modelo Gemini configurado ('${model}') no fue encontrado o no está disponible para esta API Key. Actualice GEMINI_MODEL a un modelo disponible (ej: gemini-3.5-flash-lite).`,
        );
      }
      if (response.status === 429) {
        throw new ServiceUnavailableException('Límite de cuota de Gemini API alcanzado (rate limit). Intente más tarde.');
      }
      if (response.status === 401 || response.status === 403) {
        throw new ServiceUnavailableException('Clave GEMINI_API_KEY inválida o sin permisos.');
      }
      if (response.status === 503) {
        throw new ServiceUnavailableException('El servicio de Gemini se encuentra temporalmente sobrecargado. Intente nuevamente en unos instantes.');
      }
      if (response.status === 400) {
        throw new BadGatewayException('La solicitud a Gemini contiene parámetros no soportados.');
      }
      throw new BadGatewayException(`Gemini API respondió con código de error ${response.status}`);
    }

    const data: any = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new BadGatewayException('Gemini devolvió una respuesta vacía o sin contenido estructurado.');
    }

    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new BadGatewayException('Gemini devolvió un JSON con formato inválido.');
    }
  }
}


