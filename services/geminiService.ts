
import { GoogleGenAI, Type } from "@google/genai";
import { FunnelStage, IntentResponse } from "../types";
import { RAFAEL_IDENTITY, PRODUCT_CONTEXT } from "../constants";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Missing Gemini API Key");
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  /**
   * Analisa a psicologia da mensagem para decidir a progressão do funil.
   * Não gera texto para o cliente, apenas metadados para o controlador.
   */
  async classifyIntent(
    message: string,
    currentStage: FunnelStage
  ): Promise<IntentResponse> {
    const prompt = `
      Você é o Analista de Conversação do Rafael Gusmão (Laboratório Gênesis).
      Sua função é APENAS classificar a intenção e decidir o fluxo.
      
      MENSAGEM DO CLIENTE: "${message}"
      ESTADO ATUAL: ${currentStage}
      
      REGRAS CRÍTICAS DE DECISÃO:
      1. Se o cliente demonstrar erro técnico (pix não funciona, código inválido), use 'payment_difficulty'.
      2. Se o cliente pedir para falar com atendente ou demonstrar irritação, use 'handoff'.
      3. Se o cliente apenas responder à pergunta do áudio anterior, use 'continue'.
      
      CONTEXTO DO PRODUTO (PARA ENTENDER O CLIENTE):
      ${PRODUCT_CONTEXT}

      Retorne APENAS um objeto JSON.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                enum: ['continue', 'question', 'objection', 'handoff', 'payment_difficulty']
              },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            },
            required: ["intent", "confidence"]
          }
        }
      });
      return JSON.parse(response.text) as IntentResponse;
    } catch (e) {
      console.error("Gemini Classify Error:", e);
      return { intent: 'continue', confidence: 0.5, reasoning: 'Fallback security trigger' };
    }
  }
}
