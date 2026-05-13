"use client";

import { EmptyState } from "@/components/in-lecture/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useLiveQuestions } from "@/lib/realtime/useLiveQuestions";
import { MdQuestionAnswer } from "react-icons/md";

export function QuestionFeed({ sessionId }: { sessionId: string }) {
  const questions = useLiveQuestions(sessionId);

  return (
    <Card className="h-full">
      <CardHeader
        title="Student questions"
        right={
          <span>{questions.length === 0 ? "—" : `${questions.length}`}</span>
        }
      />
      <CardBody>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {questions.length === 0 ? (
            <EmptyState
              icon={<MdQuestionAnswer />}
              title="No questions yet"
              description="Student questions land here in real time — both immediate asks and ones queued for after lecture."
            />
          ) : (
            <ul className="flex flex-col gap-2.5 px-4 py-4">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="border-divider bg-primary-bg/40 rounded-xl border p-3.5"
                >
                  <div className="flex items-center justify-between pb-2">
                    <Badge tone={q.mode === "immediate" ? "accent" : "warning"}>
                      {q.mode}
                    </Badge>
                    <span className="text-secondary text-[11px]">
                      {new Date(q.asked_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-primary text-sm leading-6">{q.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
