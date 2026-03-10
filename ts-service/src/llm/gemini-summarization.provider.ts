import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  CandidateSummaryInput,
  CandidateSummaryResult,
  RecommendedDecision,
  SummarizationProvider,
} from './summarization-provider.interface';

export const GEMINI_MODEL = "gemini-2.0-flash";
export const PROMPT_VERSION = '1.0';

const SYSTEM_PROMPT = `You are a senior technical recruiter evaluating a candidate.
Analyse the provided candidate documents and return a structured JSON assessment.

Your response MUST be valid JSON only — no markdown, no prose, just the JSON object.

Schema:
{
  "score": <integer 0-100>,
  "strengths": [<string>, ...],
  "concerns": [<string>, ...],
  "summary": "<one paragraph summary>",
  "recommendedDecision": "advance" | "hold" | "reject"
}

Guidelines:
- score 80-100 → advance
- score 50-79 → hold
- score 0-49 → reject
- List 2-4 strengths and 1-3 concerns
- Keep summary under 100 words`;

@Injectable()
export class GeminiSummarizationProvider implements SummarizationProvider {
  private readonly logger = new Logger(GeminiSummarizationProvider.name);
  private readonly model;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });
  }

  async generateCandidateSummary(
    input: CandidateSummaryInput,
  ): Promise<CandidateSummaryResult> {
    const prompt = this.buildPrompt(input);

    const result = await this.model.generateContent(prompt);
    const raw = result.response.text().trim();

    return this.parseAndValidate(raw);
  }

  private buildPrompt(input: CandidateSummaryInput): string {
    const docs = input.documents
      .map((text, i) => `--- Document ${i + 1} ---\n${text}`)
      .join('\n\n');

    return `Candidate ID: ${input.candidateId}\n\nDocuments:\n\n${docs}`;
  }

  private parseAndValidate(raw: string): CandidateSummaryResult {
    let parsed: unknown;

    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    } catch {
      this.logger.warn(`Gemini returned non-JSON response: ${raw.slice(0, 200)}`);
      throw new Error('LLM returned malformed JSON');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('LLM response is not an object');
    }

    const obj = parsed as Record<string, unknown>;

    const score = typeof obj.score === 'number' ? obj.score : Number(obj.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`Invalid score: ${obj.score}`);
    }

    const strengths = this.parseStringArray(obj.strengths, 'strengths');
    const concerns = this.parseStringArray(obj.concerns, 'concerns');

    if (typeof obj.summary !== 'string' || obj.summary.trim() === '') {
      throw new Error('Missing or empty summary');
    }

    const validDecisions: RecommendedDecision[] = ['advance', 'hold', 'reject'];
    if (!validDecisions.includes(obj.recommendedDecision as RecommendedDecision)) {
      throw new Error(`Invalid recommendedDecision: ${obj.recommendedDecision}`);
    }

    return {
      score,
      strengths,
      concerns,
      summary: obj.summary.trim(),
      recommendedDecision: obj.recommendedDecision as RecommendedDecision,
    };
  }

  private parseStringArray(value: unknown, field: string): string[] {
    if (!Array.isArray(value)) {
      throw new Error(`${field} must be an array`);
    }
    return value.map((item) => {
      if (typeof item !== 'string') throw new Error(`${field} must be an array of strings`);
      return item;
    });
  }
}
