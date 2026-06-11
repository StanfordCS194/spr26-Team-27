import type { LiveQuestion } from "@/lib/realtime/useLiveQuestions";

export type PromptType =
  | "im_lost"
  | "re_explain"
  | "what_just_happened"
  | "give_example";

export interface TranscriptLine {
  id: string;
  sequence: number;
  timestamp: string;
  timestampSeconds: number;
  content: string;
}

export interface ConfusionSignal {
  id: string;
  prompt_type: PromptType;
  created_at: string;
  anchor_transcript_item_id: string | null;
}

export interface ConfusionMoment {
  key: string;
  count: number;
  timestamp: string;
  timestampSeconds: number;
  concept: string;
  promptType: PromptType;
  promptLabel: string;
  transcriptSnippet: string;
}

export interface QuestionCluster {
  key: string;
  title: string;
  count: number;
  questions: LiveQuestion[];
}

export interface LectureSummary {
  mainConcepts: string[];
  confusingMoments: ConfusionMoment[];
  questionThemes: QuestionCluster[];
  suggestedReview: string[];
}

const STOP_WORDS = new Set([
  "a",
  "about",
  "actually",
  "again",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "get",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "like",
  "me",
  "of",
  "on",
  "or",
  "our",
  "please",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "where",
  "why",
  "with",
  "would",
  "you",
]);

const PROMPT_LABELS: Record<PromptType, string> = {
  im_lost: "I'm lost",
  re_explain: "Re-explain",
  what_just_happened: "What just happened?",
  give_example: "Give an example",
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function titleFromTokens(tokens: string[]): string {
  if (tokens.length === 0) return "Recent lecture concept";
  return tokens
    .slice(0, 5)
    .map((token) => token[0]?.toUpperCase() + token.slice(1))
    .join(" ");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return overlap / (a.size + b.size - overlap);
}

export function transcriptWindow(
  lines: readonly TranscriptLine[],
  anchorId: string | null,
  radius = 2,
): TranscriptLine[] {
  if (lines.length === 0) return [];
  const idx = anchorId
    ? lines.findIndex((line) => line.id === anchorId)
    : lines.length - 1;
  const center = idx === -1 ? lines.length - 1 : idx;
  return lines.slice(Math.max(0, center - radius), center + radius + 1);
}

export function extractConcept(text: string): string {
  const tokens = words(text);
  return titleFromTokens(tokens);
}

export function buildConfusionMoments({
  signals,
  transcript,
  windowSeconds = 600,
}: {
  signals: readonly ConfusionSignal[];
  transcript: readonly TranscriptLine[];
  windowSeconds?: number;
}): ConfusionMoment[] {
  const cutoff = Date.now() - windowSeconds * 1000;
  const lineById = new Map(transcript.map((line) => [line.id, line]));
  const groups = new Map<
    string,
    { signals: ConfusionSignal[]; line: TranscriptLine }
  >();

  for (const signal of signals) {
    if (new Date(signal.created_at).getTime() < cutoff) continue;
    const line = signal.anchor_transcript_item_id
      ? lineById.get(signal.anchor_transcript_item_id)
      : transcript.at(-1);
    if (!line) continue;
    const bucket = Math.floor(line.timestampSeconds / 45);
    const key = String(bucket);
    const prev = groups.get(key);
    if (prev) prev.signals.push(signal);
    else groups.set(key, { signals: [signal], line });
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const promptCounts = new Map<PromptType, number>();
      for (const signal of group.signals) {
        promptCounts.set(
          signal.prompt_type,
          (promptCounts.get(signal.prompt_type) ?? 0) + 1,
        );
      }
      const promptType =
        [...promptCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        "im_lost";
      const snippetLines = transcriptWindow(transcript, group.line.id, 2);
      const transcriptSnippet = snippetLines
        .map((line) => line.content)
        .join(" ");
      return {
        key,
        count: group.signals.length,
        timestamp: group.line.timestamp,
        timestampSeconds: group.line.timestampSeconds,
        concept: extractConcept(transcriptSnippet),
        promptType,
        promptLabel: PROMPT_LABELS[promptType],
        transcriptSnippet,
      };
    })
    .sort(
      (a, b) => b.count - a.count || b.timestampSeconds - a.timestampSeconds,
    )
    .slice(0, 4);
}

export function clusterQuestions(
  questions: readonly LiveQuestion[],
): QuestionCluster[] {
  const clusters: {
    key: string;
    tokens: Set<string>;
    questions: LiveQuestion[];
  }[] = [];

  for (const question of questions) {
    const tokenSet = new Set(words(question.content));
    const match = clusters.find((cluster) => {
      const score = jaccard(cluster.tokens, tokenSet);
      return score >= 0.35 || [...tokenSet].some((t) => cluster.tokens.has(t));
    });

    if (match) {
      match.questions.push(question);
      for (const token of tokenSet) match.tokens.add(token);
    } else {
      clusters.push({
        key: question.id,
        tokens: tokenSet,
        questions: [question],
      });
    }
  }

  return clusters
    .map((cluster) => ({
      key: cluster.key,
      title: titleFromTokens([...cluster.tokens]),
      count: cluster.questions.length,
      questions: cluster.questions.sort((a, b) => {
        const answered =
          Number(Boolean(a.answered_at)) - Number(Boolean(b.answered_at));
        if (answered !== 0) return answered;
        return new Date(b.asked_at).getTime() - new Date(a.asked_at).getTime();
      }),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

export function generateConceptCheck(
  transcript: readonly TranscriptLine[],
  moments: readonly ConfusionMoment[],
): { prompt: string; choices: string[] } {
  const latestMoment = moments[0];
  const context = latestMoment
    ? latestMoment.transcriptSnippet
    : transcript
        .slice(-5)
        .map((line) => line.content)
        .join(" ");
  const concept = latestMoment?.concept ?? extractConcept(context);

  return {
    prompt: `Which statement best explains ${concept}?`,
    choices: [
      `It follows from the most recent lecture example about ${concept}.`,
      "It is a separate idea that was not connected to the lecture context.",
      "It only matters after the lecture ends.",
      "It is unrelated to the course material.",
    ],
  };
}

export function buildLectureSummary({
  transcript,
  questions,
  moments,
}: {
  transcript: readonly TranscriptLine[];
  questions: readonly LiveQuestion[];
  moments: readonly ConfusionMoment[];
}): LectureSummary {
  const transcriptText = transcript.map((line) => line.content).join(" ");
  const tokens = words(transcriptText);
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

  const mainConcepts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([token]) => titleFromTokens([token]));

  const questionThemes = clusterQuestions(questions).slice(0, 4);
  const suggestedReview = [
    ...moments.map((m) => m.concept),
    ...questionThemes.map((theme) => theme.title),
    ...mainConcepts,
  ].filter((item, idx, arr) => item && arr.indexOf(item) === idx);

  return {
    mainConcepts,
    confusingMoments: moments.slice(0, 3),
    questionThemes,
    suggestedReview: suggestedReview.slice(0, 5),
  };
}
